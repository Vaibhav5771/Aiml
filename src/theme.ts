/**
 * JavaScript mirror of the design tokens.
 *
 * `src/global.css` is the SOURCE OF TRUTH and carries the reasoning behind
 * each value. This file exists only for the places React Native takes a colour
 * value rather than a className: an icon's `color` prop, and the navigation
 * theme. If you change a colour here, change it there too.
 *
 * Every value below was measured against WCAG AA (4.5:1 for small text).
 * Apple's published values do not all pass, so these are corrected. Measure
 * before you change one.
 */

export const colors = {
  background: '#FFFFFF',
  card: '#F5F5F7',
  hairline: 'rgba(0,0,0,0.08)',
  /** Apple blue, darkened so it clears 4.5:1 on the grey card as well as white. */
  primary: '#0062C4',
  accent: '#0062C4',
  ink: '#1D1D1F',
  /** Apple's own #86868b scores 3.62:1 and fails. This one is 5.07:1. */
  inkSoft: '#6E6E73',
} as const;

/**
 * One colour per verdict, each darkened from the Apple system colour until it
 * is legible as small text. Never the only signal: every verdict also carries
 * an icon and a word, so a colour blind reader and a greyscale screenshot both
 * still work. That is a hard rule from spec 0001.
 */
export const verdictColors = {
  recyclable: '#176B33',
  notRecyclable: '#D70015',
  checkManually: '#B25000',
} as const;

/** The info icon on a caveat row. */
export const noteIcon = '#6E6E73';

/**
 * The warm brand flow, mirroring the `auth-*` tokens in `global.css`. It is
 * also used by Home, History and Result. `ink`/`primary`/`leaf` are the exact brand swatches,
 * `primary` is a fill colour only, and `link` is a derived stand-in for
 * anywhere `primary` would otherwise be used as text.
 */
export const authColors = {
  background: '#F5ECD9',
  surface: '#F7F2E6',
  hairline: 'rgba(21,17,13,0.14)',
  ink: '#03180C',
  inkSoft: '#58544D',
  primary: '#F97A1B',
  link: '#B94415',
  spark: '#F35A1B',
  leaf: '#43A64C',
} as const;
