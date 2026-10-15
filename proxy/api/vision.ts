/**
 * The vision proxy. One function, one job.
 *
 * Spec 0001 put this between the phone and Gemini for a single reason: the API
 * key stays here and never ships inside the app. The app holds only this
 * function's public URL.
 *
 * Contract, fixed by spec 0001 and filled in by spec 0003:
 *   POST  { image: "<base64 jpeg>", mimeType: "image/jpeg" }
 *   200   { itemName, note?, attributes: { ...six } }
 *   4xx/5xx { error: "<machine readable code>" }
 *
 * Never a partial result. Either the attributes came back clean and validated,
 * or this returns one declared code the app can switch on. That is what lets
 * feature 10 give every failure its own screen state.
 *
 * The model reports what it SEES. It is never told the region and never
 * returns a verdict, because the verdict has to come from feature 4's local
 * rules, which can cite a source.
 */

import { GoogleGenAI } from '@google/genai';

import { PROMPT_VERSION, SYSTEM_INSTRUCTION, USER_PROMPT } from './prompt';
import {
  geminiJsonSchema,
  geminiReplySchema,
  normalise,
  type GeminiReply,
  type VisionRead,
} from './schema';

export const config = { runtime: 'nodejs' };

/**
 * The model that produced a result is recoverable from git, which is why this
 * is a constant rather than an environment variable. Spec 0003 names
 * `gemini-3.5-flash-lite` as the fallback if quota becomes the binding
 * constraint, but reread the photo set before trusting it on a faded symbol.
 */
const MODEL = 'gemini-3.8-flash';

/**
 * One budget for BOTH attempts, started before the first call.
 *
 * The worst case is therefore 25 seconds rather than two times 25, so this
 * always lands inside the app's 30 second REQUEST_TIMEOUT_MS and the app gets
 * a code back rather than a dead socket.
 */
const DEADLINE_MS = 25_000;

/**
 * Named for what it actually measures. The check below counts base64
 * characters, which run roughly a third larger than the image's real bytes, so
 * the true ceiling is nearer 4.5MB of image. Harmless, and spec 0003 asked for
 * the honest name.
 */
const MAX_IMAGE_BASE64_CHARS = 6 * 1024 * 1024;

/** How much of a bad model reply reaches the log. Never the image, never the key. */
const RAW_LOG_CHARS = 2000;

export type ErrorCode =
  | 'method_not_allowed'
  | 'malformed_json'
  | 'missing_image'
  | 'unsupported_media_type'
  | 'image_too_large'
  | 'vision_not_configured'
  | 'vision_unavailable'
  | 'vision_rate_limited'
  | 'vision_invalid_response'
  | 'vision_timeout'
  | 'no_packaging_found';

/** Renaming a code is a breaking change: feature 10 switches on these. */
const STATUS: Record<ErrorCode, number> = {
  method_not_allowed: 405,
  malformed_json: 400,
  missing_image: 400,
  unsupported_media_type: 400,
  image_too_large: 413,
  vision_not_configured: 500,
  vision_unavailable: 502,
  vision_rate_limited: 429,
  vision_invalid_response: 502,
  vision_timeout: 504,
  no_packaging_found: 422,
};

type VisionRequest = { image: string; mimeType: string };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/* ---------------------------------------------------------------------------
 * The read itself, kept apart from the handler so it can be tested without a
 * network call or a cent of quota.
 * ------------------------------------------------------------------------ */

/** One attempt. `ok` means Gemini answered, not that the answer was any good. */
export type CallResult = { ok: true; text: string } | { ok: false; code: ErrorCode };

export type GeminiCall = () => Promise<CallResult>;

export type ReadResult =
  { ok: true; value: VisionRead } | { ok: false; code: ErrorCode; raw?: string };

function parseReply(text: string): { ok: true; reply: GeminiReply } | { ok: false } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false };
  }

  const parsed = geminiReplySchema.safeParse(data);
  return parsed.success ? { ok: true, reply: parsed.data } : { ok: false };
}

/**
 * Call, validate, and retry exactly once on a validation failure.
 *
 * The retry is identical: no prompt mutation, because a prompt that changes
 * between attempts makes a logged result impossible to reproduce. A transport
 * failure is not retried at all, since it already carries a declared code the
 * app can act on, and retrying it would spend the budget on the same wall.
 */
export async function readPackaging(call: GeminiCall, expired: () => boolean): Promise<ReadResult> {
  let raw: string | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const called = await call();
    if (!called.ok) return { ok: false, code: called.code };

    raw = called.text;
    const parsed = parseReply(called.text);

    if (parsed.ok) {
      // Branch on packagingFound before looking at attributes at all. This is
      // what stops the app ever having to ask whether a 200 found anything.
      return parsed.reply.packagingFound
        ? { ok: true, value: normalise(parsed.reply) }
        : { ok: false, code: 'no_packaging_found' };
    }

    // A retry only helps if there is budget left to make it.
    if (attempt === 1 && expired()) return { ok: false, code: 'vision_timeout', raw };
  }

  return { ok: false, code: 'vision_invalid_response', raw };
}

/**
 * The HTTP status a thrown SDK error carries, whichever kind of error it is.
 *
 * `@google/genai` ships two unrelated error families and exports only one of
 * them. `interactions.create` throws the internal family (`RateLimitError`
 * extends `APIError` extends `GeminiNextGenAPIClientError`), which is NOT an
 * instance of the exported `ApiError`, so a class check here sent every real
 * rate limit to `vision_unavailable` while a unit test holding a hand built
 * `ApiError` stayed green.
 *
 * Both families set a numeric `status`, so the status is the discriminator
 * that survives the SDK renaming its classes again. A transport failure
 * carries no status and falls through to `vision_unavailable`, which is right.
 */
function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | undefined)?.status;
  return typeof status === 'number' ? status : undefined;
}

/** Which declared code a thrown SDK error becomes. */
export function callErrorCode(error: unknown, aborted: boolean): ErrorCode {
  if (aborted) return 'vision_timeout';
  if (statusOf(error) === 429) return 'vision_rate_limited';
  return 'vision_unavailable';
}

function geminiCall(
  apiKey: string,
  { image, mimeType }: VisionRequest,
  signal: AbortSignal,
): GeminiCall {
  const client = new GoogleGenAI({ apiKey });

  return async () => {
    try {
      const interaction = await client.interactions.create(
        {
          model: MODEL,
          // Nothing is retained by the provider. This is what lets the queued
          // privacy note say something short and true.
          store: false,
          system_instruction: SYSTEM_INSTRUCTION,
          input: [
            { type: 'image', mime_type: mimeType, data: image },
            { type: 'text', text: USER_PROMPT },
          ],
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: geminiJsonSchema(),
          },
        },
        // The SDK's own retries are off: AC-3 allows exactly one retry and it
        // is the one in readPackaging, inside the shared deadline.
        { signal, retries: { strategy: 'none' } },
      );

      // An empty reply is a validation failure, not a transport failure, so it
      // earns the retry rather than failing the request outright.
      return { ok: true, text: interaction.output_text ?? '' };
    } catch (error) {
      return { ok: false, code: callErrorCode(error, signal.aborted) };
    }
  };
}

/* ------------------------------------------------------------------------ */

type LogFields = {
  outcome: ErrorCode | 'ok';
  geminiLatencyMs: number;
  requestSizeBase64Chars: number;
  raw?: string;
};

/** One line per request. Never the image bytes, never the key. */
function log({ raw, ...fields }: LogFields): void {
  console.log(
    JSON.stringify({
      at: 'vision',
      ...fields,
      promptVersion: PROMPT_VERSION,
      ...(raw === undefined ? {} : { rawReply: raw.slice(0, RAW_LOG_CHARS) }),
    }),
  );
}

export default async function handler(request: Request): Promise<Response> {
  let sizeChars = 0;
  let geminiLatencyMs = 0;

  const done = (outcome: ErrorCode | 'ok', body: unknown, raw?: string): Response => {
    log({ outcome, geminiLatencyMs, requestSizeBase64Chars: sizeChars, raw });
    return json(outcome === 'ok' ? 200 : STATUS[outcome], body);
  };

  const fail = (code: ErrorCode, raw?: string): Response => done(code, { error: code }, raw);

  if (request.method !== 'POST') return fail('method_not_allowed');

  let payload: Partial<VisionRequest>;
  try {
    payload = (await request.json()) as Partial<VisionRequest>;
  } catch {
    return fail('malformed_json');
  }

  const { image, mimeType } = payload;

  if (typeof image !== 'string' || image.length === 0) return fail('missing_image');
  sizeChars = image.length;

  if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
    return fail('unsupported_media_type');
  }
  if (image.length > MAX_IMAGE_BASE64_CHARS) return fail('image_too_large');

  if (!process.env.GEMINI_API_KEY) {
    // Fail loudly rather than silently returning nothing useful. A missing key
    // is a deployment mistake, not a user facing condition.
    return fail('vision_not_configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  const startedAt = Date.now();

  try {
    const result = await readPackaging(
      geminiCall(process.env.GEMINI_API_KEY, { image, mimeType }, controller.signal),
      () => controller.signal.aborted,
    );

    geminiLatencyMs = Date.now() - startedAt;

    return result.ok ? done('ok', result.value) : fail(result.code, result.raw);
  } finally {
    clearTimeout(timer);
  }
}
