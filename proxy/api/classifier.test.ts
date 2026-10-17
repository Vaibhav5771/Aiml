/**
 * The second opinion's own tests. No network, no token, no quota.
 *
 * Everything that decides anything in `classifier.ts` is pure, so all of it is
 * covered here against literals. The one impure function, `classifierCall`,
 * is reached through the `ClassifierCall` seam instead, exactly as `vision.ts`
 * reaches Gemini through `GeminiCall`.
 *
 * The rule these tests exist to hold: a broken classifier must never be able
 * to fail a request or change a read. Spec 0005, AC-6.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  agreementWith,
  classify,
  CLASSIFIER_VERSION,
  LABEL_TO_MATERIAL,
  MATERIAL_FAMILY,
  parseClassification,
  type ClassifierCall,
} from './classifier.js';
import { CODES } from './schema.js';

/** The 11 labels the model actually has, verbatim from its `config.json`. */
const MODEL_LABELS = [
  'aluminium',
  'batteries',
  'cardboard',
  'disposable plates',
  'glass',
  'hard plastic',
  'paper',
  'paper towel',
  'polystyrene',
  'soft plastics',
  'takeaway cups',
] as const;

describe('the label map', () => {
  it('covers every label the model can emit, and invents none', () => {
    assert.deepEqual(Object.keys(LABEL_TO_MATERIAL).sort(), [...MODEL_LABELS].sort());
  });

  it('only ever maps to a code the vocabulary already has', () => {
    for (const material of Object.values(LABEL_TO_MATERIAL)) {
      if (material === undefined) continue;
      assert.ok(
        (CODES.material as readonly string[]).includes(material),
        `${material} is not in CODES.material`,
      );
    }
  });

  it('declines to guess a material for the two labels that name an item', () => {
    // Not a gap. A battery is not packaging, and a disposable plate is paper,
    // polystyrene or plastic depending on the shop.
    assert.equal(LABEL_TO_MATERIAL.batteries, undefined);
    assert.equal(LABEL_TO_MATERIAL['disposable plates'], undefined);
  });

  it('calls a takeaway cup a laminate, because that is what it is', () => {
    assert.equal(LABEL_TO_MATERIAL['takeaway cups'], 'composite_laminate');
  });
});

describe('material families', () => {
  it('places every material code in a family', () => {
    // Exhaustive by construction: a code added to spec 0003 with no family
    // would otherwise compare as `undefined === undefined` and agree with
    // everything, which is the quietest possible way for this to go wrong.
    for (const code of CODES.material) {
      assert.ok(MATERIAL_FAMILY[code] !== undefined, `${code} has no family`);
    }
  });
});

describe('agreementWith', () => {
  it('agrees across resins, because the classifier cannot read a resin code', () => {
    // The case that would fire the gate on nearly every plastic item in the
    // world if agreement were asked code to code instead of family to family.
    assert.equal(agreementWith('other_plastic', 'pp'), 'agree');
    assert.equal(agreementWith('other_plastic', 'pet'), 'agree');
    assert.equal(agreementWith('ps', 'hdpe'), 'agree');
  });

  it('agrees across paper and cardboard', () => {
    assert.equal(agreementWith('paper', 'cardboard'), 'agree');
  });

  it('disagrees when a paper read meets a laminate', () => {
    // The signal the whole second opinion exists to produce.
    assert.equal(agreementWith('composite_laminate', 'paper'), 'disagree');
  });

  it('disagrees across genuinely different families', () => {
    assert.equal(agreementWith('glass', 'pet'), 'disagree');
    assert.equal(agreementWith('aluminium', 'cardboard'), 'disagree');
  });

  it('treats no material opinion as no opinion, never a disagreement', () => {
    assert.equal(agreementWith(undefined, 'pet'), 'no_opinion');
  });

  it('treats an unknown on either side as no opinion', () => {
    // Two models declining to guess is not a conflict.
    assert.equal(agreementWith('unknown', 'pet'), 'no_opinion');
    assert.equal(agreementWith('glass', 'unknown'), 'no_opinion');
  });
});

describe('parseClassification', () => {
  it('reads the top label and scales the probability to 0 to 100', () => {
    const out = parseClassification([{ label: 'glass', score: 0.9712 }], 'glass');

    assert.ok(out.ok);
    assert.equal(out.value.label, 'glass');
    assert.equal(out.value.score, 97);
    assert.equal(out.value.material, 'glass');
    assert.equal(out.value.agrees, 'agree');
    assert.equal(out.value.modelVersion, CLASSIFIER_VERSION);
  });

  it('takes the highest score rather than the first row', () => {
    // The provider documents the array as the distribution and promises
    // nothing binding about its order.
    const out = parseClassification(
      [
        { label: 'paper', score: 0.12 },
        { label: 'aluminium', score: 0.81 },
        { label: 'glass', score: 0.07 },
      ],
      'aluminium',
    );

    assert.ok(out.ok);
    assert.equal(out.value.label, 'aluminium');
    assert.equal(out.value.score, 81);
  });

  it('omits material entirely when the label names no material', () => {
    const out = parseClassification([{ label: 'batteries', score: 0.99 }], 'pet');

    assert.ok(out.ok);
    assert.equal('material' in out.value, false);
    assert.equal(out.value.agrees, 'no_opinion');
  });

  it('flags the cup case as a disagreement', () => {
    const out = parseClassification([{ label: 'takeaway cups', score: 0.88 }], 'paper');

    assert.ok(out.ok);
    assert.equal(out.value.agrees, 'disagree');
  });

  it('ignores malformed rows but still reads the good ones', () => {
    const out = parseClassification(
      [{ label: 'glass' }, { score: 0.5 }, { label: 'paper', score: 0.6 }],
      'paper',
    );

    assert.ok(out.ok);
    assert.equal(out.value.label, 'paper');
  });

  it('refuses a label the model does not have', () => {
    // A different model is answering this URL, which is a deployment mistake
    // rather than a bad photo.
    const out = parseClassification([{ label: 'banana', score: 0.99 }], 'pet');

    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, 'classifier_invalid_response');
  });

  it('refuses a reply that is not a non empty array of rows', () => {
    for (const body of [null, undefined, {}, [], 'glass', [1, 2, 3]]) {
      const out = parseClassification(body, 'pet');
      assert.equal(out.ok, false, `${JSON.stringify(body)} should be refused`);
    }
  });

  it('never lets a score escape 0 to 100', () => {
    // A provider returning a logit instead of a probability must not produce a
    // score the rest of the product would read as a confidence.
    const high = parseClassification([{ label: 'glass', score: 4.2 }], 'glass');
    const low = parseClassification([{ label: 'glass', score: -1 }], 'glass');

    assert.ok(high.ok && low.ok);
    assert.equal(high.value.score, 100);
    assert.equal(low.value.score, 0);
  });
});

describe('classify', () => {
  const call = (result: Awaited<ReturnType<ClassifierCall>>): ClassifierCall => async () => result;

  it('passes a transport failure straight through', async () => {
    const out = await classify(call({ ok: false, code: 'classifier_timeout' }), 'pet');

    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, 'classifier_timeout');
  });

  it('does not retry', async () => {
    let calls = 0;
    const counting: ClassifierCall = async () => {
      calls++;
      return { ok: false, code: 'classifier_unavailable' };
    };

    await classify(counting, 'pet');

    // A second opinion that needs two attempts has already cost more than it
    // is worth. Unlike `readPackaging`, there is no retry here.
    assert.equal(calls, 1);
  });

  it('never throws, whatever the body is', async () => {
    const out = await classify(call({ ok: true, body: { nonsense: true } }), 'pet');
    assert.equal(out.ok, false);
  });
});
