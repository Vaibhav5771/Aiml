/**
 * One vision read turned into the ordered numbers the model scores.
 *
 * Pure and total: every code in the spec 0003 vocabulary maps to a number, so
 * there is no read this cannot describe and no branch that can throw.
 *
 * This file and `ml/features.py` have to agree exactly, in the same way
 * `src/vision/types.ts` and `proxy/api/schema.ts` have to agree. Reading both
 * carefully is not the plan: build task 6 makes `ml/train.py` emit a fixture
 * of reads with their computed vectors, and `score.test.ts` replays it here
 * (spec 0005, AC-17). Until that lands, this side is the only side.
 *
 * WHICH features these are is not settled. Spec 0005 defers the choice to
 * build task 6, which compares candidate sets by cross validation on the
 * training split alone. What follows is the starting candidate: the six scores
 * the engine already reasons about, two summaries of them, and three flags for
 * the "it could not tell" cases that survive the four written gates. Expect
 * task 6 to add to it or cut it down, and expect `FEATURE_NAMES` to be
 * rewritten in step with `ml/features.py` when it does.
 */

import { ATTRIBUTE_ORDER } from '@/vision/types';
import type { VisionAttributes } from '@/vision/types';

/**
 * The feature names, in the order `weights` is aligned to.
 *
 * The artifact repeats this list and the loader refuses to use one whose list
 * differs, so the two can never drift apart silently.
 */
export const FEATURE_NAMES = [
  'score_material',
  'score_form',
  'score_recyclingSymbol',
  'score_construction',
  'score_contamination',
  'score_photoQuality',
  'score_min',
  'score_mean',
  'unknown_share',
  'symbol_unreadable',
  'photo_fair',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/**
 * How many attributes can come back `unknown`.
 *
 * Five, not six: `photoQuality` describes the photo rather than the packaging,
 * so spec 0003 gives it no `unknown` code and it is always assessable.
 * Dividing by the real maximum keeps `unknown_share` a true 0 to 1 share.
 */
const UNKNOWN_CAPABLE = 5;

/** Spec 0003 scores run 0 to 100; every feature here is 0 to 1. */
const SCORE_MAX = 100;

/**
 * The ordered feature vector for one read.
 *
 * Returns plain numbers in `FEATURE_NAMES` order, every one between 0 and 1.
 * It reads only the six codes and the six scores, never the `display` text,
 * which is prose the model has no business learning from.
 */
export function features(a: VisionAttributes): number[] {
  const scores = ATTRIBUTE_ORDER.map((key) => a[key].score / SCORE_MAX);
  const unknown = ATTRIBUTE_ORDER.filter((key) => a[key].code === 'unknown').length;
  const symbolUnreadable = a.recyclingSymbol.code !== 'readable';

  return [
    ...scores,
    Math.min(...scores),
    scores.reduce((sum, n) => sum + n, 0) / scores.length,
    unknown / UNKNOWN_CAPABLE,
    symbolUnreadable ? 1 : 0,
    a.photoQuality.code === 'fair' ? 1 : 0,
  ];
}
