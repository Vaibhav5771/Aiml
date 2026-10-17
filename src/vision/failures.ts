/**
 * What each failure looks like on screen, and what to do about it.
 *
 * Feature 10 (Waiting and failure states) is what this file is. `errors.ts`
 * owns the vocabulary and one terse line each, which is what the walking
 * skeleton needed; this owns the words a person reads, the icon beside them,
 * and the way forward. Nothing here is shared with the skeleton's map on
 * purpose, so the throwaway copy can be deleted without touching this.
 *
 * Three rules it keeps, and they are the whole point of the file existing
 * rather than a `switch` inside the screen:
 *
 * 1. EVERY code has an entry. `Record<VisionErrorCode, …>` makes that a
 *    compile error rather than a blank screen in production, so adding a code
 *    to `errors.ts` forces someone to decide what it says here.
 * 2. Every entry has a way forward. `recover` is required, never optional, so
 *    there is no shape in which a dead end can be expressed.
 * 3. Nothing blames the person. A bad photo is the one failure they can act
 *    on, and even that is phrased as what the app could not do.
 *
 * Pure data, no device, no network.
 */

import type { VisionErrorCode } from './errors';

/**
 * What the one button does.
 *
 * `retake` reopens the camera, because the photo is the problem. `retry`
 * resends the photo already taken, because the photo is fine and something
 * else gave way, and resending beats making someone frame the shot again.
 *
 * The distinction is not cosmetic: on a slow connection, `retry` is the
 * difference between one more request and one more photo plus one more
 * request.
 */
export type Recovery = 'retake' | 'retry';

export type VisionFailure = {
  readonly title: string;
  readonly explanation: string;
  readonly recover: Recovery;
};

/**
 * Every way the chain can give way, with the words for it.
 *
 * Grouped as `errors.ts` groups them: what the proxy said, then what happened
 * before the proxy was reached or after its answer arrived.
 *
 * Several of these are deployment faults rather than anything a user did, and
 * they say so plainly instead of pretending the photo was at fault. Telling
 * someone to retake a perfectly good photo of a yoghurt tub because a Vercel
 * environment variable is missing is how an app teaches people to distrust it.
 */
export const VISION_FAILURE: Record<VisionErrorCode, VisionFailure> = {
  /* ---- the service answered, with a refusal ---- */

  no_packaging_found: {
    title: 'No packaging in that photo',
    explanation:
      'Nothing in the frame looked like a package or a container. Fill the frame with the item itself, and include any symbols printed on it.',
    recover: 'retake',
  },
  vision_rate_limited: {
    title: 'The reading service is busy',
    explanation:
      'Too many requests reached it at once. Your photo is still here, so it can go again in a moment without being retaken.',
    recover: 'retry',
  },
  vision_timeout: {
    title: 'The reading took too long',
    explanation:
      'The service did not finish in time. This is usually a slow connection rather than a problem with your photo.',
    recover: 'retry',
  },
  vision_unavailable: {
    title: 'The reading service is down',
    explanation:
      'It could not be reached. Nothing is wrong with your photo, and nothing was saved.',
    recover: 'retry',
  },
  vision_invalid_response: {
    title: 'The reading came back unreadable',
    explanation:
      'The service answered, but not with something this app could make sense of. That is a fault at its end, not with your photo.',
    recover: 'retry',
  },
  vision_not_configured: {
    title: 'The reading service is not set up',
    explanation:
      'It is missing the key it needs to read a photo. That is a setup problem in this build, so retaking the photo will not help.',
    recover: 'retry',
  },

  /* ---- the request was refused before it was read ---- */

  image_too_large: {
    title: 'That photo was too large to send',
    explanation:
      'It should have been shrunk before sending and was not. Another photo will usually go through.',
    recover: 'retake',
  },
  unsupported_media_type: {
    title: 'That photo format could not be read',
    explanation: 'The service accepts ordinary camera photos. One taken here will work.',
    recover: 'retake',
  },
  // The app builds its own requests, so these three can only mean the app and
  // the service have drifted apart. They are kept honest rather than hidden:
  // nobody should be told to retake a photo over a bug in the request shape.
  missing_image: {
    title: 'The photo did not reach the service',
    explanation:
      'The request arrived without it. That is a fault in this build rather than anything you did.',
    recover: 'retry',
  },
  malformed_json: {
    title: 'The service could not read the request',
    explanation:
      'The app sent something it did not understand. That is a fault in this build rather than anything you did.',
    recover: 'retry',
  },
  method_not_allowed: {
    title: 'The service refused the request',
    explanation:
      'It was asked in a way it does not accept. That is a fault in this build rather than anything you did.',
    recover: 'retry',
  },

  /* ---- the service was never reached, or never believed ---- */

  network_unreachable: {
    title: 'No connection',
    explanation:
      'The photo could not be sent. Reading the packaging happens on a server, so this needs a connection. Your photo is still here.',
    recover: 'retry',
  },
  request_timeout: {
    title: 'That took too long',
    explanation:
      'Nothing came back in time. Your photo is still here and can go again without being retaken.',
    recover: 'retry',
  },
  proxy_not_configured: {
    title: 'This build has no service address',
    explanation:
      'EXPO_PUBLIC_PROXY_URL is not set, so there is nowhere to send the photo. Retaking it will not help.',
    recover: 'retry',
  },
  unexpected_response: {
    title: 'Something else answered',
    explanation:
      'The reply did not match what the reading service promises. A sign-in page on a shared network is the usual cause.',
    recover: 'retry',
  },
  photo_unreadable: {
    title: 'That photo could not be prepared',
    explanation:
      'It could not be resized and encoded on this device, so it never left. Another photo will usually work.',
    recover: 'retake',
  },
};

/** The button under the explanation. One per failure, never none. */
export const RECOVERY_LABEL: Record<Recovery, string> = {
  retake: 'Take another photo',
  retry: 'Try again',
};
