/**
 * The handler's tests. No network, no quota.
 *
 * The Gemini call is injected into `readPackaging`, so the retry rule, the
 * deadline and the error taxonomy are all exercised against stubs. The
 * request validation half runs the real handler, which never reaches Gemini
 * because it fails before it would.
 */

import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { ApiError } from '@google/genai';

import handler, { callErrorCode, readPackaging, type CallResult, type GeminiCall } from './vision';

const VALID_REPLY = JSON.stringify({
  packagingFound: true,
  itemName: 'Yogurt tub',
  attributes: {
    material: { code: 'pp', display: 'Polypropylene, code 5', score: 88 },
    form: { code: 'rigid', display: 'Rigid', score: 91 },
    recyclingSymbol: { code: 'faded', display: 'Found, partly faded', score: 74 },
    construction: { code: 'single_material', display: 'Single material', score: 91 },
    contamination: { code: 'clean', display: 'Looks clean', score: 80 },
    photoQuality: { code: 'good', display: 'Sharp and well lit', score: 95 },
  },
});

/** A call that answers each of `replies` in turn, and counts how often it was asked. */
function stubCall(...replies: CallResult[]): GeminiCall & { calls: () => number } {
  let seen = 0;
  const call = async () => replies[Math.min(seen++, replies.length - 1)];
  return Object.assign(call, { calls: () => seen });
}

const never = () => false;

describe('readPackaging: the happy path', () => {
  it('returns the normalised read on the first good reply', async () => {
    const call = stubCall({ ok: true, text: VALID_REPLY });
    const result = await readPackaging(call, never);

    assert.equal(result.ok, true);
    assert.equal(call.calls(), 1, 'a good reply never costs a second call');
    if (result.ok) {
      assert.equal(result.value.itemName, 'Yogurt tub');
      assert.equal(result.value.attributes.material.confidence, 'high');
    }
  });
});

describe('readPackaging: the one retry', () => {
  it('retries exactly once when the first reply fails validation', async () => {
    const call = stubCall({ ok: true, text: '{"packagingFound":true}' }, { ok: true, text: VALID_REPLY });
    const result = await readPackaging(call, never);

    assert.equal(result.ok, true);
    assert.equal(call.calls(), 2);
  });

  it('gives up with vision_invalid_response after the second failure', async () => {
    const bad = { ok: true, text: '{"attributes":"nonsense"}' } as const;
    const call = stubCall(bad, bad);
    const result = await readPackaging(call, never);

    assert.deepEqual(result.ok, false);
    assert.equal(call.calls(), 2, 'exactly two attempts, never a third');
    if (!result.ok) assert.equal(result.code, 'vision_invalid_response');
  });

  it('keeps the raw reply so the log can show what came back', async () => {
    const bad = { ok: true, text: 'not json at all' } as const;
    const result = await readPackaging(stubCall(bad, bad), never);

    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.raw, 'not json at all');
  });

  it('treats an empty reply as a validation failure, so it earns the retry', async () => {
    const call = stubCall({ ok: true, text: '' }, { ok: true, text: VALID_REPLY });
    const result = await readPackaging(call, never);

    assert.equal(result.ok, true);
    assert.equal(call.calls(), 2);
  });

  it('does not retry a transport failure, which already carries a code', async () => {
    const call = stubCall({ ok: false, code: 'vision_unavailable' });
    const result = await readPackaging(call, never);

    assert.equal(call.calls(), 1);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'vision_unavailable');
  });
});

describe('readPackaging: the shared deadline', () => {
  it('does not spend a retry it has no time for', async () => {
    const call = stubCall({ ok: true, text: 'rubbish' }, { ok: true, text: VALID_REPLY });
    // The budget ran out while the first attempt was in flight.
    const result = await readPackaging(call, () => true);

    assert.equal(call.calls(), 1, 'the retry is skipped once the budget is gone');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'vision_timeout');
  });
});

describe('readPackaging: nothing to read', () => {
  it('returns no_packaging_found rather than six unknowns', async () => {
    const call = stubCall({ ok: true, text: '{"packagingFound":false}' });
    const result = await readPackaging(call, never);

    assert.equal(call.calls(), 1, 'a complete answer, so no retry');
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'no_packaging_found');
  });
});

/**
 * Stands in for the error family `interactions.create` actually throws.
 *
 * `@google/genai` does not export those classes, and none of them is an
 * `ApiError`, which is exactly why a class check in `callErrorCode` missed
 * every rate limit. What they do carry is a numeric `status`, so that is what
 * this mirrors and what the mapping now reads.
 */
class SdkError extends Error {
  readonly status?: number;

  constructor(name: string, status?: number) {
    super(`${status ?? ''} stubbed ${name}`.trim());
    this.name = name;
    this.status = status;
  }
}

describe('callErrorCode', () => {
  it('calls an aborted request a timeout, whatever was thrown', () => {
    assert.equal(callErrorCode(new Error('aborted'), true), 'vision_timeout');
  });

  it('maps a 429 to vision_rate_limited, whatever class the SDK threw', () => {
    // The shape `interactions.create` really throws. Asserting against the
    // exported `ApiError` alone is what hid the bug: the two are unrelated.
    assert.equal(callErrorCode(new SdkError('RateLimitError', 429), false), 'vision_rate_limited');
    assert.equal(
      callErrorCode(new ApiError({ message: 'quota', status: 429 }), false),
      'vision_rate_limited',
    );
  });

  it('maps any other API error to vision_unavailable', () => {
    assert.equal(callErrorCode(new SdkError('InternalServerError', 500), false), 'vision_unavailable');
    assert.equal(
      callErrorCode(new ApiError({ message: 'boom', status: 500 }), false),
      'vision_unavailable',
    );
  });

  it('maps a transport failure, which carries no status, to vision_unavailable', () => {
    assert.equal(callErrorCode(new SdkError('APIConnectionError'), false), 'vision_unavailable');
  });

  it('maps a plain thrown error to vision_unavailable', () => {
    assert.equal(callErrorCode(new TypeError('fetch failed'), false), 'vision_unavailable');
  });
});

describe('the handler: request validation', () => {
  const URL = 'https://proxy.test/api/vision';
  const KEY = process.env.GEMINI_API_KEY;
  const logged: string[] = [];

  beforeEach(() => {
    logged.length = 0;
    mock.method(console, 'log', (line: string) => void logged.push(line));
  });

  afterEach(() => {
    mock.restoreAll();
    if (KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = KEY;
  });

  const post = (body: unknown) =>
    new Request(URL, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

  async function errorFrom(request: Request): Promise<{ status: number; error: string }> {
    const response = await handler(request);
    const body = (await response.json()) as { error: string };
    return { status: response.status, error: body.error };
  }

  it('rejects anything but POST', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    assert.deepEqual(await errorFrom(new Request(URL)), {
      status: 405,
      error: 'method_not_allowed',
    });
  });

  it('rejects a body that is not JSON', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    assert.deepEqual(await errorFrom(post('{oops')), { status: 400, error: 'malformed_json' });
  });

  it('rejects a missing or empty image', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    assert.deepEqual(await errorFrom(post({ mimeType: 'image/jpeg' })), {
      status: 400,
      error: 'missing_image',
    });
    assert.deepEqual(await errorFrom(post({ image: '', mimeType: 'image/jpeg' })), {
      status: 400,
      error: 'missing_image',
    });
  });

  it('rejects a mimeType that is not an image', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    assert.deepEqual(await errorFrom(post({ image: 'AAAA', mimeType: 'application/pdf' })), {
      status: 400,
      error: 'unsupported_media_type',
    });
  });

  it('rejects an image over the ceiling before it costs a call', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const huge = 'A'.repeat(6 * 1024 * 1024 + 1);
    assert.deepEqual(await errorFrom(post({ image: huge, mimeType: 'image/jpeg' })), {
      status: 413,
      error: 'image_too_large',
    });
  });

  it('fails loudly when the key is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    assert.deepEqual(await errorFrom(post({ image: 'AAAA', mimeType: 'image/jpeg' })), {
      status: 500,
      error: 'vision_not_configured',
    });
  });

  it('logs the outcome, the size and the prompt version on every request', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    await handler(post({ image: 'AAAABBBB', mimeType: 'application/pdf' }));

    assert.equal(logged.length, 1);
    const line = JSON.parse(logged[0]);
    assert.equal(line.outcome, 'unsupported_media_type');
    assert.equal(line.requestSizeBase64Chars, 8);
    assert.equal(typeof line.geminiLatencyMs, 'number');
    assert.ok(line.promptVersion);
  });

  it('never writes the key or the image bytes to a log or a body', async () => {
    process.env.GEMINI_API_KEY = 'super-secret-key';
    const image = 'UNIQUEIMAGEBYTES'.repeat(8);

    const response = await handler(post({ image, mimeType: 'application/pdf' }));
    const body = await response.text();
    const everything = `${body}\n${logged.join('\n')}`;

    assert.equal(everything.includes('super-secret-key'), false);
    assert.equal(everything.includes(image), false);
    assert.equal(everything.includes('UNIQUEIMAGEBYTES'), false);
  });
});
