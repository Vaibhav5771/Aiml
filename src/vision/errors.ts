/**
 * Why a read failed, in one machine readable code.
 *
 * The first group is `proxy/api/vision.ts`'s own `ErrorCode`, mirrored by
 * hand. `proxy/AGENTS.md` forbids the app and the proxy from importing each
 * other, so this is the same deliberate duplication `types.ts` carries, for
 * the same reason, with the same silent drift risk that spec 0003 names. The
 * proxy is the authority: if you rename a code there, rename it here.
 *
 * The second group never comes from the proxy. These are the ways a read can
 * fail before the proxy is reached, or after its answer arrives: the phone is
 * offline, the photo could not be prepared, nothing came back inside the
 * app's own deadline, the body was not the shape the contract promises.
 *
 * Feature 10 (Waiting and failure states) is what turns each of these into a
 * screen with a way forward. What lives here is the vocabulary and one plain
 * line each, which is all the walking skeleton needs to say something true
 * instead of leaving a spinner running.
 */

/** Mirrored from `proxy/api/vision.ts`. Keep in step by hand. */
export const PROXY_ERROR_CODES = [
  'method_not_allowed',
  'malformed_json',
  'missing_image',
  'unsupported_media_type',
  'image_too_large',
  'vision_not_configured',
  'vision_unavailable',
  'vision_rate_limited',
  'vision_invalid_response',
  'vision_timeout',
  'no_packaging_found',
] as const;

/** The app's own. The proxy never sends these, because it was never reached or never believed. */
export const APP_ERROR_CODES = [
  /** `EXPO_PUBLIC_PROXY_URL` is empty, so there is nothing to call. */
  'proxy_not_configured',
  /** The photo could not be resized or encoded on the device. */
  'photo_unreadable',
  /** The request never left, or never arrived. Usually no network. */
  'network_unreachable',
  /** `REQUEST_TIMEOUT_MS` expired before the proxy answered. */
  'request_timeout',
  /** A 200 whose body is not a `VisionRead`. The hand copied schema drifted, or something is in front of the proxy. */
  'unexpected_response',
] as const;

export type ProxyErrorCode = (typeof PROXY_ERROR_CODES)[number];
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];
export type VisionErrorCode = ProxyErrorCode | AppErrorCode;

/**
 * Is this string one the proxy is allowed to have sent?
 *
 * A proxy that answers with a code this build has never heard of is treated as
 * `unexpected_response` rather than passed through, so a screen can never be
 * handed a code it has no state for.
 */
export function isProxyErrorCode(value: unknown): value is ProxyErrorCode {
  return typeof value === 'string' && (PROXY_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * One plain line per failure, for the walking skeleton.
 *
 * Deliberately terse and deliberately temporary. Feature 10 owns the real
 * copy, the icon and the way forward for each of these; it should replace this
 * map rather than extend it. Every line here says what happened, never what
 * the person did wrong.
 */
export const VISION_ERROR_TEXT: Record<VisionErrorCode, string> = {
  // From the proxy.
  method_not_allowed: 'The service refused the request.',
  malformed_json: 'The service could not read the request.',
  missing_image: 'No photo reached the service.',
  unsupported_media_type: 'That photo format cannot be read.',
  image_too_large: 'The photo was too large to send.',
  vision_not_configured: 'The service is missing its key.',
  vision_unavailable: 'The reading service is down.',
  vision_rate_limited: 'The reading service is busy. Try again in a moment.',
  vision_invalid_response: 'The reading came back unreadable.',
  vision_timeout: 'The reading service took too long.',
  no_packaging_found: 'No packaging was found in that photo.',
  // From the app.
  proxy_not_configured: 'This build has no service address set.',
  photo_unreadable: 'The photo could not be prepared.',
  network_unreachable: 'No connection. Check your network.',
  request_timeout: 'The reading took too long.',
  unexpected_response: 'The service answered with something unexpected.',
};
