/**
 * The app's one call to the vision proxy.
 *
 * This is the piece feature 7 (the walking skeleton) exists to put in place:
 * the single point where a prepared photo leaves the device and six named
 * observations come back. Nothing else in the app talks to the network.
 *
 * It follows the convention the rest of the project already keeps: an expected
 * failure is a returned value, never a throw. Every path out of here is either
 * a validated `VisionRead` or exactly one code from `errors.ts`, so the caller
 * has no third case to handle and no exception to catch.
 *
 * Pure in the sense that matters: it holds no state, caches nothing, and the
 * only side effect is the request itself.
 */

import { PROXY_URL, REQUEST_TIMEOUT_MS } from '@/constants';

import { isProxyErrorCode } from './errors';
import type { VisionErrorCode } from './errors';
import { parseVisionRead } from './validate';
import type { VisionRead } from './types';

export type VisionResult =
  | { readonly ok: true; readonly value: VisionRead }
  | { readonly ok: false; readonly error: VisionErrorCode };

/** What `prepare` hands over: the downscaled JPEG, already encoded. */
export type PreparedPhoto = {
  readonly base64: string;
  readonly mimeType: string;
};

const fail = (error: VisionErrorCode): VisionResult => ({ ok: false, error });

/**
 * Build the endpoint the same way `scripts/check-photoset.mjs` does.
 *
 * The trailing slash strip matters: `.env.example` asks for an origin, and a
 * pasted URL with a slash on the end would otherwise produce `//api/vision`,
 * which some hosts answer with a redirect the app would read as a failure.
 */
function endpoint(base: string): string {
  return `${base.replace(/\/$/, '')}/api/vision`;
}

/**
 * Send one prepared photo and get back six observations, or one failure code.
 *
 * The deadline here is the app's, not the proxy's. Spec 0003 sizes the proxy's
 * own budget at 25 seconds against this 30, so in the ordinary case a slow read
 * comes back as `vision_timeout` with a real response, and this abort only
 * fires when the proxy itself is unreachable or wedged.
 */
export async function readPackaging(photo: PreparedPhoto): Promise<VisionResult> {
  if (PROXY_URL.length === 0) return fail('proxy_not_configured');

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint(PROXY_URL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: photo.base64, mimeType: photo.mimeType }),
      signal: controller.signal,
    });
  } catch {
    // One catch, two meanings. An abort is our own deadline firing; anything
    // else never reached the proxy at all, which on a phone is almost always
    // the network being gone.
    return fail(controller.signal.aborted ? 'request_timeout' : 'network_unreachable');
  } finally {
    clearTimeout(deadline);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // A body that is not JSON is not the proxy answering. A captive portal
    // login page is the ordinary cause of this on a phone.
    return fail('unexpected_response');
  }

  if (!response.ok) {
    // The proxy's contract is that every failure carries one declared code. A
    // code this build has never heard of is not passed through, because a
    // screen would have no state for it.
    const code: unknown = (body as { error?: unknown } | null)?.error;
    return fail(isProxyErrorCode(code) ? code : 'unexpected_response');
  }

  const read = parseVisionRead(body);
  return read === undefined ? fail('unexpected_response') : { ok: true, value: read };
}
