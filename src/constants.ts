/**
 * App wide constants that are not design tokens.
 *
 * Nothing secret belongs in this file. Spec 0001 keeps the Gemini key on the
 * Vercel function only, so the app knows the proxy URL and nothing more.
 */

/**
 * The vision proxy you own. Set `EXPO_PUBLIC_PROXY_URL` in `.env` (see
 * `.env.example`). Anything prefixed `EXPO_PUBLIC_` is baked into the app
 * bundle and is readable by anyone holding the build, so only ever put public
 * values behind that prefix.
 */
export const PROXY_URL = process.env.EXPO_PUBLIC_PROXY_URL ?? '';

/** The region whose recycling rules this build ships. Feature 4 writes the rules. */
export const REGION = {
  city: 'Pune',
  country: 'India',
  label: 'Pune, India',
} as const;

/**
 * How a photo is prepared before it is sent.
 *
 * Spec 0001: resize the long edge to about 1568px at quality 0.8. Reading a
 * faded symbol is the whole product, so this is the wrong place to economize,
 * but above roughly this size the major vision models stop gaining, so bigger
 * uploads cost time and buy nothing.
 */
export const PHOTO = {
  maxLongEdge: 1568,
  quality: 0.8,
} as const;

/** How long the app waits on the proxy before giving up and showing a failure state. */
export const REQUEST_TIMEOUT_MS = 30_000;
