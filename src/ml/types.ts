/**
 * The shape of the trained artifact the app ships.
 *
 * [Spec 0005](../../docs/specs/0005-learned-second-opinion/index.md) is the
 * authority. The short version: `ml/train.py` writes `model.json`, the app
 * reads it, and nothing else about the model crosses between the two
 * languages. Changing a field here means changing the writer too.
 *
 * Nothing in this file decides anything, and nothing here is secret: the
 * artifact ships inside the bundle, so it carries counts and a date and never
 * a path, a filename or anything personal from the training set.
 */

/**
 * What `modelVersion` reads when the model could not be consulted.
 *
 * A literal rather than `undefined`, so a stored scan always says something
 * about the model, and "we never asked" is told apart from "we asked and it
 * said nothing".
 */
export const UNAVAILABLE_VERSION = 'unavailable';

/** What the training run reports about itself. Quoted in the learned gate's citation. */
export type TrainedOn = {
  /** How many labelled photos the run was trained on. */
  readonly photos: number;
  /** How many were held out and never trained on. */
  readonly heldOut: number;
  /** ISO date of the run, e.g. `2026-11-02`. */
  readonly date: string;
};

/**
 * A regularised logistic regression, flattened to the few numbers scoring
 * needs.
 *
 * `features` is the contract, not documentation: it is the exact order
 * `weights` is aligned to, and the loader refuses an artifact whose list does
 * not match the TypeScript extractor name for name. A silently misaligned
 * weight vector would score every read wrongly and never once throw, so the
 * check happens at load and the artifact is simply dropped.
 */
export type ModelArtifact = {
  /** e.g. `v1`. Recorded on every scan the model judged. */
  readonly version: string;
  /** 0 to 1. Below this trust score, the learned gate fires. */
  readonly threshold: number;
  /** Ordered feature names. Must equal `FEATURE_NAMES` exactly. */
  readonly features: readonly string[];
  /** Same length as `features`, same order. */
  readonly weights: readonly number[];
  /** The intercept. */
  readonly bias: number;
  readonly trainedOn: TrainedOn;
};
