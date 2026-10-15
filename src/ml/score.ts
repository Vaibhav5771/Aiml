/**
 * The learned second opinion, scored on the phone.
 *
 * A regularised logistic regression trained offline in Python
 * ([spec 0005](../../docs/specs/0005-learned-second-opinion/index.md)),
 * exported as a weight vector, and evaluated here as a dot product. There is
 * no inference library and no native module: the whole of scoring is one
 * multiply and add, which is why it can stay pure and synchronous.
 *
 * Everything here is pure. `trust` reads the bundled artifact that the module
 * loaded once at import, never the file system at call time, so the rule
 * engine downstream of it stays pure too.
 *
 * Nothing in this file decides anything. It produces two numbers; `src/rules/`
 * decides what they mean, and the only thing they can ever do is hold an
 * answer back.
 */

import type { LearnedTrust } from '@/rules/types';
import type { VisionAttributes } from '@/vision/types';

import { FEATURE_NAMES, features } from './features';
import modelJson from './model.json';
import type { ModelArtifact } from './types';

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isProbability(v: unknown): v is number {
  return isFiniteNumber(v) && v >= 0 && v <= 1;
}

/**
 * Read an artifact, or refuse it.
 *
 * Exported and taking `unknown` on purpose: a missing file, a truncated one, a
 * hand edited one and a well formed one from a different build all arrive here
 * the same way, so all four are testable with no file system games and no
 * Python (spec 0005, AC-6).
 *
 * Every failure is the same failure, `undefined`, because the app's answer to
 * all of them is identical: skip the learned gate and behave exactly as the
 * written rules alone would. A model this build cannot trust is worth less
 * than no model, so nothing here tries to repair a bad artifact.
 */
export function loadModel(raw: unknown): ModelArtifact | undefined {
  try {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const m = raw as Record<string, unknown>;

    if (typeof m.version !== 'string' || m.version.trim().length === 0) return undefined;
    if (!isProbability(m.threshold)) return undefined;
    if (!isFiniteNumber(m.bias)) return undefined;
    if (!Array.isArray(m.features) || !Array.isArray(m.weights)) return undefined;
    if (m.weights.length !== m.features.length) return undefined;
    if (!m.weights.every(isFiniteNumber)) return undefined;

    // The ordered feature list IS the contract. A weight vector aligned to a
    // different order would score every read wrongly and never once throw, so
    // a mismatch drops the artifact rather than trusting the numbers.
    if (m.features.length !== FEATURE_NAMES.length) return undefined;
    if (!m.features.every((name, i) => name === FEATURE_NAMES[i])) return undefined;

    const t = m.trainedOn;
    if (typeof t !== 'object' || t === null) return undefined;
    const trained = t as Record<string, unknown>;
    if (!isFiniteNumber(trained.photos) || trained.photos < 0) return undefined;
    if (!isFiniteNumber(trained.heldOut) || trained.heldOut < 0) return undefined;
    if (typeof trained.date !== 'string' || trained.date.trim().length === 0) return undefined;

    return {
      version: m.version,
      threshold: m.threshold,
      features: [...(m.features as string[])],
      weights: [...(m.weights as number[])],
      bias: m.bias,
      trainedOn: { photos: trained.photos, heldOut: trained.heldOut, date: trained.date },
    };
  } catch {
    // Nothing above should throw, which is exactly why this is here: an
    // artifact is untrusted input, and a learned refusal must never be the
    // thing that crashes a scan.
    return undefined;
  }
}

/** The logistic function. Maps any real number into 0 to 1, exclusive at both ends. */
function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

/**
 * Score one read against one artifact.
 *
 * Separate from `trust` so a test can hand it a weight vector written by hand,
 * with no bundled file involved (spec 0005, AC-15).
 *
 * Returns `undefined` rather than a number the caller would have to range
 * check: a score outside 0 to 1 means the artifact or the extractor is wrong,
 * and a wrong trust score is worse than none.
 */
export function scoreWith(
  model: ModelArtifact,
  attributes: VisionAttributes,
): LearnedTrust | undefined {
  try {
    const vector = features(attributes);
    if (vector.length !== model.weights.length) return undefined;

    const z = vector.reduce((sum, v, i) => sum + v * model.weights[i], model.bias);
    const score = sigmoid(z);
    if (!isProbability(score)) return undefined;

    return { score, threshold: model.threshold };
  } catch {
    return undefined;
  }
}

/**
 * The bundled artifact, or `undefined` if this build shipped one it cannot
 * use.
 *
 * Read once, at module load, so `trust` has no side effect of its own and the
 * engine downstream of it stays pure.
 */
export const MODEL: ModelArtifact | undefined = loadModel(modelJson);

/**
 * What this build thinks of one vision read.
 *
 * `undefined` means the model was not consulted, and the rule engine then
 * behaves exactly as it did before spec 0005 existed.
 */
export function trust(attributes: VisionAttributes): LearnedTrust | undefined {
  return MODEL === undefined ? undefined : scoreWith(MODEL, attributes);
}

export { FEATURE_NAMES, features } from './features';
export { UNAVAILABLE_VERSION } from './types';
export type { ModelArtifact, TrainedOn } from './types';
