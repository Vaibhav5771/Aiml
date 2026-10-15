/**
 * The learned scorer, held to its contract.
 *
 * No device, no network, no Python and no Gemini quota. Every artifact in here
 * is written by hand, so these tests prove the behaviour rather than the
 * particular numbers that happen to be bundled today, and they keep passing
 * when build task 8 swaps the stub for trained weights. Run it with `npm test`.
 *
 * What is NOT proved here yet: that `ml/features.py` computes the same vector
 * as `features.ts`. Build task 6 owns that (spec 0005, AC-17). It emits a
 * fixture of reads with their Python side vectors, and this file replays it.
 * Until then this side is the only side, and the two can still drift.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type {
  ConstructionCode,
  ContaminationCode,
  FormCode,
  MaterialCode,
  PhotoQualityCode,
  SymbolCode,
  VisionAttributes,
} from '@/vision/types';

import { FEATURE_NAMES, features } from './features';
import { MODEL, loadModel, scoreWith, trust } from './score';
import { UNAVAILABLE_VERSION } from './types';
import type { ModelArtifact } from './types';

type Codes = {
  material: MaterialCode;
  form: FormCode;
  recyclingSymbol: SymbolCode;
  construction: ConstructionCode;
  contamination: ContaminationCode;
  photoQuality: PhotoQualityCode;
};

/** A clean, sharply photographed, rigid PET tub, the same baseline the engine tests use. */
const CLEAN: Codes = {
  material: 'pet',
  form: 'rigid',
  recyclingSymbol: 'readable',
  construction: 'single_material',
  contamination: 'clean',
  photoQuality: 'good',
};

function attributes(
  codes: Partial<Codes> = {},
  scores: Partial<Record<keyof Codes, number>> = {},
  everyScore = 90,
): VisionAttributes {
  const c = { ...CLEAN, ...codes };
  const at = <T extends string>(key: keyof Codes, code: T) => ({
    code,
    display: '',
    confidence: 'high' as const,
    score: scores[key] ?? everyScore,
  });
  return {
    material: at('material', c.material),
    form: at('form', c.form),
    recyclingSymbol: at('recyclingSymbol', c.recyclingSymbol),
    construction: at('construction', c.construction),
    contamination: at('contamination', c.contamination),
    photoQuality: at('photoQuality', c.photoQuality),
  };
}

/** A well formed artifact. Tests break one field at a time off this. */
function artifact(overrides: Partial<ModelArtifact> = {}): ModelArtifact {
  return {
    version: 'test',
    threshold: 0.5,
    features: [...FEATURE_NAMES],
    weights: FEATURE_NAMES.map(() => 0),
    bias: 0,
    trainedOn: { photos: 10, heldOut: 2, date: '2026-10-13' },
    ...overrides,
  };
}

describe('the feature extractor', () => {
  test('emits one number per declared name, in that order', () => {
    assert.equal(features(attributes()).length, FEATURE_NAMES.length);
  });

  test('puts every feature between 0 and 1, so no one of them can dominate', () => {
    for (const score of [0, 1, 50, 99, 100]) {
      for (const v of features(attributes({}, {}, score))) {
        assert.ok(v >= 0 && v <= 1, `${v} is outside 0 to 1`);
      }
    }
  });

  test('computes the vector exactly, so the Python side has something to match', () => {
    // Every score 50, every code the untroubled one. Halves divide exactly in
    // binary, so this vector carries no floating point slack and can be
    // asserted whole rather than within a tolerance.
    assert.deepEqual(
      features(attributes({}, {}, 50)),
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0, 0, 0],
    );
  });

  test('reads the weakest link and the average off the six scores', () => {
    const v = features(
      attributes(
        {},
        {
          material: 40,
          form: 80,
          recyclingSymbol: 20,
          construction: 100,
          contamination: 60,
          photoQuality: 90,
        },
      ),
    );
    assert.deepEqual(v.slice(0, 6), [0.4, 0.8, 0.2, 1, 0.6, 0.9]);
    assert.equal(v[FEATURE_NAMES.indexOf('score_min')], 0.2);
    assert.ok(Math.abs(v[FEATURE_NAMES.indexOf('score_mean')] - 0.65) < 1e-12);
  });

  test('counts only the attributes that can come back unknown', () => {
    const share = (a: VisionAttributes) => features(a)[FEATURE_NAMES.indexOf('unknown_share')];
    assert.equal(share(attributes()), 0);
    assert.equal(share(attributes({ material: 'unknown' })), 1 / 5);
    assert.equal(
      share(
        attributes({
          material: 'unknown',
          form: 'unknown',
          recyclingSymbol: 'unknown',
          construction: 'unknown',
          contamination: 'unknown',
        }),
      ),
      1,
    );
  });

  test('treats faded, absent and unknown alike: the symbol was not readable', () => {
    const flag = (code: SymbolCode) =>
      features(attributes({ recyclingSymbol: code }))[FEATURE_NAMES.indexOf('symbol_unreadable')];
    assert.equal(flag('readable'), 0);
    for (const code of ['faded', 'absent', 'unknown'] as const) assert.equal(flag(code), 1);
  });

  test('is total over the whole vocabulary: no read it cannot describe', () => {
    // The gates mean the model only ever sees survivors, but a feature
    // extractor that throws on a code it was not expecting would take a scan
    // down with it. Every combination has to produce real numbers.
    const MATERIALS: readonly MaterialCode[] = [
      'pet',
      'hdpe',
      'pvc',
      'ldpe',
      'pp',
      'ps',
      'other_plastic',
      'glass',
      'aluminium',
      'steel',
      'paper',
      'cardboard',
      'composite_laminate',
      'unknown',
    ];
    const FORMS: readonly FormCode[] = ['rigid', 'film', 'foam', 'fibre', 'unknown'];
    const SYMBOLS: readonly SymbolCode[] = ['readable', 'faded', 'absent', 'unknown'];
    const CONSTRUCTIONS: readonly ConstructionCode[] = [
      'single_material',
      'multi_material',
      'unknown',
    ];
    const CONTAMINATIONS: readonly ContaminationCode[] = [
      'clean',
      'light_residue',
      'heavy_residue',
      'unknown',
    ];
    const QUALITIES: readonly PhotoQualityCode[] = ['good', 'fair', 'poor'];

    let checked = 0;
    for (const material of MATERIALS)
      for (const form of FORMS)
        for (const recyclingSymbol of SYMBOLS)
          for (const construction of CONSTRUCTIONS)
            for (const contamination of CONTAMINATIONS)
              for (const photoQuality of QUALITIES) {
                const v = features(
                  attributes({
                    material,
                    form,
                    recyclingSymbol,
                    construction,
                    contamination,
                    photoQuality,
                  }),
                );
                assert.ok(v.every(Number.isFinite), 'a feature came back as not a number');
                checked += 1;
              }
    assert.equal(checked, 14 * 5 * 4 * 3 * 4 * 3);
  });

  test('is pure, and leaves the read it was given alone', () => {
    const a = attributes({ material: 'glass' });
    const before = JSON.stringify(a);
    assert.deepEqual(features(a), features(a));
    assert.equal(JSON.stringify(a), before);
  });
});

describe('loading an artifact (AC-6)', () => {
  test('accepts a well formed one', () => {
    assert.notEqual(loadModel(artifact()), undefined);
  });

  test('refuses anything that is not an artifact at all', () => {
    // A missing file arrives as `undefined`; a truncated or hand mangled one
    // arrives as anything at all. None of them may throw.
    for (const raw of [undefined, null, 0, '', 'v1', [], true, {}]) {
      assert.equal(loadModel(raw), undefined, `accepted ${JSON.stringify(raw)}`);
    }
  });

  test('refuses an artifact that cannot say which version it is', () => {
    for (const version of ['', '   ', undefined, 7]) {
      assert.equal(loadModel({ ...artifact(), version }), undefined, `accepted version ${version}`);
    }
  });

  test('refuses a threshold that is not a probability', () => {
    for (const threshold of [-0.1, 1.7, Number.NaN, Infinity, '0.5', undefined]) {
      assert.equal(loadModel({ ...artifact(), threshold }), undefined, `accepted ${threshold}`);
    }
  });

  test('refuses weights that do not line up with the feature names', () => {
    assert.equal(loadModel(artifact({ weights: [0, 0] })), undefined);
    assert.equal(loadModel({ ...artifact(), weights: 'nope' }), undefined);
    assert.equal(
      loadModel(artifact({ weights: FEATURE_NAMES.map((_, i) => (i === 0 ? Number.NaN : 0)) })),
      undefined,
    );
  });

  test('refuses a feature list in the wrong order, which is the dangerous one', () => {
    // Same names, same count, same weight length: nothing here would throw and
    // nothing downstream would look wrong. It would simply score every read
    // against the wrong columns forever, so it has to be caught at load.
    const swapped: string[] = [...FEATURE_NAMES];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    assert.equal(loadModel(artifact({ features: swapped })), undefined);

    const renamed: string[] = [...FEATURE_NAMES];
    renamed[3] = 'score_something_else';
    assert.equal(loadModel(artifact({ features: renamed })), undefined);
  });

  test('refuses an artifact that will not say what it was trained on', () => {
    // The learned gate quotes these counts as its citation, so an artifact
    // that cannot report them cannot be cited, and an uncitable refusal is
    // exactly what spec 0005 refuses to ship.
    for (const trainedOn of [
      undefined,
      null,
      {},
      { photos: 10, heldOut: 2 },
      { photos: -1, heldOut: 2, date: '2026-10-13' },
      { photos: 10, heldOut: Number.NaN, date: '2026-10-13' },
      { photos: 10, heldOut: 2, date: '' },
    ]) {
      assert.equal(loadModel({ ...artifact(), trainedOn }), undefined, 'accepted a bad trainedOn');
    }
  });

  test('copies the artifact out rather than holding the caller object', () => {
    const raw = artifact();
    const loaded = loadModel(raw);
    assert.ok(loaded !== undefined);
    assert.notEqual(loaded.weights, raw.weights);
    assert.deepEqual(loaded.weights, raw.weights);
  });
});

describe('scoring against a hand written weight vector (AC-15)', () => {
  test('is a logistic regression, and here is the arithmetic to prove it', () => {
    // Every score 50, so the vector is [0.5 x 8, 0, 0, 0]. One weight of 1 on
    // the first column and no bias puts z at exactly 0.5, and the logistic of
    // 0.5 is 0.6224593312018546. If this number moves, the scorer stopped
    // being the function `ml/train.py` fitted.
    const weights = FEATURE_NAMES.map((_, i) => (i === 0 ? 1 : 0));
    const t = scoreWith(artifact({ weights }), attributes({}, {}, 50));
    assert.ok(t !== undefined);
    assert.ok(Math.abs(t.score - 0.6224593312018546) < 1e-12, `got ${t.score}`);
  });

  test('puts the bias through the same function', () => {
    const t = scoreWith(artifact({ bias: -2 }), attributes({}, {}, 50));
    assert.ok(t !== undefined);
    assert.ok(Math.abs(t.score - 0.11920292202211755) < 1e-12, `got ${t.score}`);
  });

  test('hands the threshold back untouched, because the engine compares the two', () => {
    const t = scoreWith(artifact({ threshold: 0.42 }), attributes());
    assert.equal(t?.threshold, 0.42);
  });

  test('stays inside 0 to 1 however large the weights get', () => {
    for (const w of [1e6, -1e6]) {
      const t = scoreWith(artifact({ weights: FEATURE_NAMES.map(() => w) }), attributes());
      assert.ok(t !== undefined);
      assert.ok(t.score >= 0 && t.score <= 1, `${t.score} is outside 0 to 1`);
    }
  });

  test('returns nothing rather than a score that is not a probability (AC-6)', () => {
    // A wrong trust score is worse than none: it would refuse real scans on
    // arithmetic nobody can account for.
    const nan = artifact({ weights: FEATURE_NAMES.map((_, i) => (i === 0 ? Number.NaN : 0)) });
    assert.equal(scoreWith(nan, attributes()), undefined);
    assert.equal(scoreWith(artifact({ weights: [1, 2] }), attributes()), undefined);
  });

  test('is pure: the same artifact and read always give the same score (AC-7)', () => {
    const m = artifact({ weights: FEATURE_NAMES.map((_, i) => i / 10), bias: 0.3 });
    const a = attributes({ recyclingSymbol: 'faded' });
    assert.deepEqual(scoreWith(m, a), scoreWith(m, a));
  });
});

describe('the artifact this build ships', () => {
  test('loads, so the app is not silently running with no model', () => {
    assert.notEqual(MODEL, undefined, 'the bundled model.json did not pass its own loader');
    assert.notEqual(MODEL?.version, UNAVAILABLE_VERSION);
  });

  test('is still the stub, and the stub can never refuse anything', () => {
    // Build task 8 replaces this. Until a threshold has been chosen from a
    // published risk coverage curve (AC-12), shipping one that fires would
    // refuse real scans on numbers nobody measured. A threshold of 0 is below
    // every possible score, so the learned check stays dormant by arithmetic
    // rather than by a flag someone could forget to turn off.
    assert.equal(MODEL?.version, 'v0-stub');
    assert.equal(MODEL?.threshold, 0);

    for (const codes of [
      {},
      { material: 'unknown' as const },
      { recyclingSymbol: 'faded' as const },
    ]) {
      const t = trust(attributes(codes, {}, 10));
      assert.ok(t !== undefined);
      assert.ok(t.score >= t.threshold, 'the stub refused a read, which it must never do');
    }
  });

  test('trust is pure and gives a probability for any read', () => {
    const a = attributes({ material: 'composite_laminate', photoQuality: 'fair' });
    const t = trust(a);
    assert.deepEqual(trust(a), t);
    assert.ok(t !== undefined && t.score >= 0 && t.score <= 1);
  });
});
