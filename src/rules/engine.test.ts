/**
 * The engine, exercised against the real Pune rule set.
 *
 * This is the highest risk logic in the product and it is pure, so all of it
 * can be proved here with no network, no device and no Gemini quota. Run it
 * with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type {
  Agreement,
  ConstructionCode,
  ContaminationCode,
  FormCode,
  MaterialCode,
  PhotoQualityCode,
  SecondOpinion,
  SymbolCode,
  VisionRead,
} from '@/vision/types';

import { BANDS, MATERIAL_CODES, SOURCE_SCOPES, bandFor } from '@/vision/types';

import { FEATURE_NAMES } from '@/ml/features';
import { scoreWith } from '@/ml/score';
import type { ModelArtifact } from '@/ml/types';

import {
  DISAGREEMENT_GATE_ID,
  LEARNED_GATE_ID,
  MIN_DECIDING_SCORE,
  MIN_DISAGREEMENT_SCORE,
  NO_MATCH_CONFIDENCE,
  PUNE_RULES,
  RINSE_CLAUSE,
  assessWith,
  decide,
  decideWith,
  decidingRecord,
} from './index';
import type { LearnedTrust, RuleSet } from './types';

type Codes = {
  material: MaterialCode;
  form: FormCode;
  recyclingSymbol: SymbolCode;
  construction: ConstructionCode;
  contamination: ContaminationCode;
  photoQuality: PhotoQualityCode;
};

/** A clean, sharply photographed, rigid PET tub. Nothing here trips a gate. */
const CLEAN: Codes = {
  material: 'pet',
  form: 'rigid',
  recyclingSymbol: 'readable',
  construction: 'single_material',
  contamination: 'clean',
  photoQuality: 'good',
};

function read(
  codes: Partial<Codes> = {},
  scores: Partial<Record<keyof Codes, number>> = {},
  note?: string,
): VisionRead {
  const c = { ...CLEAN, ...codes };
  const at = <T extends string>(key: keyof Codes, code: T) => ({
    code,
    display: '',
    confidence: 'high' as const,
    score: scores[key] ?? 90,
  });
  const base: VisionRead = {
    itemName: 'Test item',
    attributes: {
      material: at('material', c.material),
      form: at('form', c.form),
      recyclingSymbol: at('recyclingSymbol', c.recyclingSymbol),
      construction: at('construction', c.construction),
      contamination: at('contamination', c.contamination),
      photoQuality: at('photoQuality', c.photoQuality),
    },
  };
  return note === undefined ? base : { ...base, note };
}

/** The text a given record would put on screen, so a test can name the record it expects. */
function textOf(id: string): string {
  const record = [...PUNE_RULES.gates, ...PUNE_RULES.rules].find((r) => r.id === id);
  if (record === undefined) throw new Error(`no record with id ${id}`);
  return record.text;
}

describe('decide, as a function', () => {
  test('is pure: the same read always gives the same verdict (AC-1)', () => {
    const r = read({ material: 'pp', contamination: 'light_residue' });
    assert.deepEqual(decide(r), decide(r));
  });

  test('never touches the read it was given (AC-1)', () => {
    const r = read({ material: 'glass' });
    const before = JSON.stringify(r);
    decide(r);
    assert.equal(JSON.stringify(r), before);
  });

  test('always attaches the rule and the document behind it (AC-7)', () => {
    for (const material of ['pet', 'ps', 'pvc', 'composite_laminate'] as const) {
      const v = decide(read({ material }));
      assert.ok(v.rule.text.length > 0, `${material}: no rule text`);
      assert.ok(v.rule.source.document.length > 0, `${material}: no document`);
    }
  });

  test('carries a URL only when the cited page has one (AC-11)', () => {
    // PET rests on the national Plastic Waste Management Rules, which has a
    // page that loads. PVC rests on general practice, which has no document
    // to link, and a missing URL is the honest form of that.
    assert.equal(
      decide(read({ material: 'pet' })).rule.source.url,
      'https://cpcb.nic.in/plastic-waste/',
    );
    assert.ok(!('url' in decide(read({ material: 'pvc' })).rule.source));
  });
});

describe('the stop checks', () => {
  test('a poor photo stops everything (AC-4)', () => {
    const v = decide(read({ photoQuality: 'poor' }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, textOf('gate-photo-unreadable'));
  });

  test('an unreadable material stops everything (AC-4)', () => {
    const v = decide(read({ material: 'unknown' }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, textOf('gate-material-unreadable'));
  });

  test('two materials joined together stop everything (AC-4)', () => {
    const v = decide(read({ construction: 'multi_material' }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, textOf('gate-multi-material'));
  });

  test('heavy residue stops everything (AC-4)', () => {
    const v = decide(read({ contamination: 'heavy_residue' }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, textOf('gate-heavy-residue'));
  });

  test('run before any rule, so a confident material cannot outrank a poor photo (AC-4)', () => {
    // The whole point of the ordering: this read would be recyclable on its
    // material alone, and must not be.
    const v = decide(read({ material: 'pet', photoQuality: 'poor' }, { material: 100 }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, textOf('gate-photo-unreadable'));
  });

  test('run in their declared order when more than one would fire (AC-4)', () => {
    const v = decide(read({ photoQuality: 'poor', construction: 'multi_material' }));
    assert.equal(v.rule.text, textOf('gate-photo-unreadable'));
  });

  test('stop a material read below the deciding score (AC-4, AC-14)', () => {
    const v = decide(read({ material: 'pet' }, { material: MIN_DECIDING_SCORE - 1 }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, textOf('gate-material-unreadable'));
  });

  test('let a material read at exactly the deciding score through (AC-4, AC-14)', () => {
    const v = decide(read({ material: 'pet' }, { material: MIN_DECIDING_SCORE }));
    assert.equal(v.verdict, 'recyclable');
    assert.equal(v.rule.text, textOf('rule-pet'));
  });
});

describe('the rules', () => {
  test('a clean rigid PET tub is recyclable, with the PET rule behind it', () => {
    const v = decide(read({ material: 'pet' }, { material: 88 }));
    assert.equal(v.verdict, 'recyclable');
    assert.equal(v.action, 'Dry waste');
    assert.equal(v.rule.text, textOf('rule-pet'));
    assert.equal(v.rule.source.document, 'Plastic Waste Management Rules, 2016 (India)');
  });

  test('take the first match, so a more specific rule wins (AC-5)', () => {
    // Both the foam rule and the general polystyrene rule match foam. The foam
    // rule sits above it, so it is the one that gets to explain itself.
    assert.equal(decide(read({ material: 'ps', form: 'foam' })).rule.text, textOf('rule-ps-foam'));
    assert.equal(decide(read({ material: 'ps', form: 'rigid' })).rule.text, textOf('rule-ps'));
  });

  test('judge plastic film on its thickness rather than its resin', () => {
    assert.equal(
      decide(read({ material: 'pet', form: 'film' })).rule.text,
      textOf('rule-plastic-film'),
    );
    assert.equal(
      decide(read({ material: 'pp', form: 'film' })).rule.text,
      textOf('rule-plastic-film'),
    );
  });

  test('reach all three verdicts', () => {
    assert.equal(decide(read({ material: 'aluminium' })).verdict, 'recyclable');
    assert.equal(decide(read({ material: 'composite_laminate' })).verdict, 'notRecyclable');
    assert.equal(decide(read({ material: 'pvc' })).verdict, 'checkManually');
  });
});

describe('confidence', () => {
  test('is the score of the one attribute the rule names (AC-8)', () => {
    const v = decide(read({ material: 'pet' }, { material: 73 }));
    assert.equal(v.confidence, 73);
  });

  test('is the weakest of the attributes the rule names (AC-8)', () => {
    // The film rule names both material and form.
    const v = decide(read({ material: 'pet', form: 'film' }, { material: 91, form: 64 }));
    assert.equal(v.confidence, 64);
  });

  test('ignores an attribute the rule does not name, high or low (AC-8)', () => {
    // The PET rule names material only, so a shaky read of the form cannot
    // drag the number down and a perfect one cannot prop it up.
    const low = decide(read({ material: 'pet' }, { material: 73, form: 20, photoQuality: 30 }));
    const high = decide(read({ material: 'pet' }, { material: 73, form: 99, photoQuality: 99 }));
    assert.equal(low.confidence, 73);
    assert.equal(high.confidence, 73);
  });

  test('is the score of the attribute that tripped the gate (AC-8)', () => {
    const v = decide(read({ photoQuality: 'poor' }, { photoQuality: 62, material: 99 }));
    assert.equal(v.confidence, 62);
  });

  test('never exceeds the lowest score the decision rested on (AC-8)', () => {
    const v = decide(read({ material: 'pet', form: 'film' }, { material: 55, form: 80 }));
    assert.ok(v.confidence <= 55);
  });
});

describe('the action', () => {
  test('gains the rinse clause only for light residue (AC-9, AC-14)', () => {
    const cases: readonly [ContaminationCode, boolean][] = [
      ['clean', false],
      ['light_residue', true],
      ['unknown', false],
    ];
    for (const [contamination, rinses] of cases) {
      const v = decide(read({ material: 'pet', contamination }));
      assert.equal(
        v.action.endsWith(RINSE_CLAUSE),
        rinses,
        `${contamination} produced "${v.action}"`,
      );
    }
  });

  test('never gains it for heavy residue, which is gated instead (AC-9, AC-14)', () => {
    const v = decide(read({ material: 'pet', contamination: 'heavy_residue' }));
    assert.equal(v.verdict, 'checkManually');
    assert.ok(!v.action.endsWith(RINSE_CLAUSE));
  });

  test('reads as one sentence once the clause is on it (AC-9)', () => {
    const v = decide(read({ material: 'pet', contamination: 'light_residue' }));
    assert.equal(v.action, `Dry waste${RINSE_CLAUSE}`);
  });
});

describe('the note', () => {
  test('prefers the rule set over the proxy, so only one caveat shows (AC-10)', () => {
    const v = decide(read({ recyclingSymbol: 'faded' }, {}, 'A note from the proxy'));
    assert.equal(v.note, PUNE_RULES.notes.find((n) => n.id === 'note-symbol-faded')?.text);
  });

  test('falls back to the proxy when nothing in the rule set matches (AC-10)', () => {
    const v = decide(read({}, {}, 'A note from the proxy'));
    assert.equal(v.note, 'A note from the proxy');
  });

  test('is absent, not undefined, when there is neither (AC-10)', () => {
    const v = decide(read());
    assert.ok(!('note' in v), `note should be absent, got ${JSON.stringify(v.note)}`);
  });
});

describe('when no rule matches at all', () => {
  /*
   * The real Pune set covers every material code, which the rule set test
   * proves, so nothing in it reaches the no match record. That is the point of
   * the record: it is the backstop for the day a rule is removed or a region
   * ships an incomplete file. A fixture is the only way to exercise it, and
   * the only reason `decideWith` takes its rule set as an argument.
   */
  const bare: RuleSet = {
    region: 'Nowhere',
    version: 'test',
    gates: [],
    rules: [
      {
        id: 'no-match',
        when: {},
        verdict: 'checkManually',
        action: 'Check the packaging yourself',
        text: 'Nothing here covers that.',
        source: { document: 'General recycling practice', scope: 'general' },
      },
    ],
    notes: [],
  };

  test('says check manually, and still cites something (AC-7)', () => {
    const v = decideWith(bare, read({ material: 'glass' }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, 'Nothing here covers that.');
    assert.equal(v.rule.source.document, 'General recycling practice');
  });

  test('claims no confidence, because it rested on nothing', () => {
    // The no match record names no attribute, so the weakest link rule has
    // nothing to read. Zero is the honest answer rather than a number the
    // decision never earned.
    assert.equal(decideWith(bare, read({ material: 'glass' })).confidence, NO_MATCH_CONFIDENCE);
    assert.equal(NO_MATCH_CONFIDENCE, 0);
  });
});

/*
 * The learned second opinion, from spec 0005.
 *
 * Every test here passes `LearnedTrust` as a literal. No model file is read,
 * no `src/ml/` code runs, and nothing here would change if the artifact were
 * deleted: that is the whole point of handing the engine two numbers rather
 * than a model (spec 0005, AC-7).
 */

/** Trust the engine should act on: below the threshold, so the learned check fires. */
const UNRELIABLE: LearnedTrust = { score: 0.1, threshold: 0.5 };

/** Trust the engine should wave through: at or above the threshold. */
const RELIABLE: LearnedTrust = { score: 0.9, threshold: 0.5 };

describe('the learned check', () => {
  test('refuses a read every written check passed (AC-1, AC-4)', () => {
    // A clean, sharp, single material PET tub: nothing written objects to it,
    // so this refusal can only have come from the model.
    assert.equal(decideWith(PUNE_RULES, read()).verdict, 'recyclable');

    const v = decideWith(PUNE_RULES, read(), UNRELIABLE);
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.text, textOf(LEARNED_GATE_ID));
  });

  test('cites the model and its measurement, never a document (AC-4)', () => {
    const v = decideWith(PUNE_RULES, read(), UNRELIABLE);
    assert.match(v.rule.source.document, /model/i);
    assert.match(v.rule.source.document, /held out/);
    assert.equal(v.rule.source.url, undefined);
  });

  test('claims no confidence, because it rested on no attribute (AC-4)', () => {
    // The record names nothing in its `when`, so the weakest link rule has
    // nothing to read. A refusal resting on no attribute claims none.
    assert.equal(decideWith(PUNE_RULES, read(), UNRELIABLE).confidence, NO_MATCH_CONFIDENCE);
  });

  test('stays quiet at or above the threshold (AC-3)', () => {
    assert.deepEqual(decideWith(PUNE_RULES, read(), RELIABLE), decideWith(PUNE_RULES, read()));
    // Exactly at the threshold is not below it, so it does not fire.
    const exact: LearnedTrust = { score: 0.5, threshold: 0.5 };
    assert.deepEqual(decideWith(PUNE_RULES, read(), exact), decideWith(PUNE_RULES, read()));
  });

  test('is never consulted when a written check already fired (AC-2, AC-5)', () => {
    // A terrible trust score alongside each written stop check in turn. The
    // written citation has to win every time, or the app would start blaming
    // the model for refusals the rules made on their own.
    const written: readonly (readonly [Partial<Codes>, string])[] = [
      [{ photoQuality: 'poor' }, 'gate-photo-unreadable'],
      [{ material: 'unknown' }, 'gate-material-unreadable'],
      [{ construction: 'multi_material' }, 'gate-multi-material'],
      [{ contamination: 'heavy_residue' }, 'gate-heavy-residue'],
    ];
    for (const [codes, id] of written) {
      const v = decideWith(PUNE_RULES, read(codes), UNRELIABLE);
      assert.equal(v.rule.text, textOf(id), `${id} should have decided this read`);
    }
  });

  test('never outranks the score threshold the engine already had (AC-5)', () => {
    // `gate-material-unreadable` also fires on a low material score, which no
    // condition can express. That check still runs first.
    const v = decideWith(PUNE_RULES, read({}, { material: MIN_DECIDING_SCORE - 1 }), UNRELIABLE);
    assert.equal(v.rule.text, textOf('gate-material-unreadable'));
  });

  test('is skipped entirely when there is no trust value (AC-6)', () => {
    // The unavailable path, seen from the engine: no third argument means the
    // model was never consulted, and the verdict is what spec 0004 produced.
    const cases: readonly Partial<Codes>[] = [{}, { material: 'glass' }, { photoQuality: 'fair' }];
    for (const codes of cases) {
      const r = read(codes);
      assert.deepEqual(decideWith(PUNE_RULES, r, undefined), decideWith(PUNE_RULES, r));
    }
  });

  test('stays pure with a trust value in hand (AC-7)', () => {
    const r = read({ contamination: 'light_residue' });
    assert.deepEqual(decideWith(PUNE_RULES, r, UNRELIABLE), decideWith(PUNE_RULES, r, UNRELIABLE));
    const before = JSON.stringify(r);
    decideWith(PUNE_RULES, r, UNRELIABLE);
    assert.equal(JSON.stringify(r), before);
  });
});

describe('the learned check can only ever refuse (AC-3)', () => {
  // The invariant the whole of spec 0005 exists to protect, checked over every
  // combination the vocabulary allows rather than over a handful of examples.
  // It is the one thing no reader of this code should have to take on trust.
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

  function* matrix(): Generator<Codes> {
    for (const material of MATERIALS) {
      for (const form of FORMS) {
        for (const recyclingSymbol of SYMBOLS) {
          for (const construction of CONSTRUCTIONS) {
            for (const contamination of CONTAMINATIONS) {
              for (const photoQuality of QUALITIES) {
                yield {
                  material,
                  form,
                  recyclingSymbol,
                  construction,
                  contamination,
                  photoQuality,
                };
              }
            }
          }
        }
      }
    }
  }

  test('covers the whole vocabulary, so this is a proof and not a sample', () => {
    assert.equal([...matrix()].length, 14 * 5 * 4 * 3 * 4 * 3);
  });

  test('never promotes a verdict, changes a rule, or raises a confidence', () => {
    let refusedMore = 0;
    for (const codes of matrix()) {
      const r = read(codes);
      const without = decideWith(PUNE_RULES, r);
      const consulted = decideWith(PUNE_RULES, r, UNRELIABLE);
      const where = JSON.stringify(codes);

      if (consulted.verdict === 'checkManually') {
        if (without.verdict !== 'checkManually') refusedMore += 1;
      } else {
        // Not a refusal, so consulting the model must have changed nothing at
        // all: not the verdict, not the rule, not the citation, not the number.
        assert.deepEqual(consulted, without, `the model altered a non refusal: ${where}`);
      }
      assert.ok(
        consulted.confidence <= without.confidence,
        `confidence rose from ${without.confidence} to ${consulted.confidence}: ${where}`,
      );
    }
    // Without this, a model that could never change anything would pass the
    // loop above while proving nothing. It has to actually bite somewhere.
    assert.ok(refusedMore > 0, 'the learned check refused nothing at all, so nothing was proved');
  });

  test('changes nothing anywhere when the score is reliable', () => {
    for (const codes of matrix()) {
      const r = read(codes);
      assert.deepEqual(decideWith(PUNE_RULES, r, RELIABLE), decideWith(PUNE_RULES, r));
    }
  });
});

describe('decidingRecord', () => {
  test('names the record the verdict came from, so storage need not guess', () => {
    // `AppliedRule` carries no id, so without this a stored scan would have to
    // match on rule text to know what refused it. `decide` and `assess` both
    // read this one function, so the two cannot disagree.
    assert.equal(decidingRecord(PUNE_RULES, read(), UNRELIABLE).record.id, LEARNED_GATE_ID);
    assert.equal(decidingRecord(PUNE_RULES, read()).record.id, 'rule-pet');
    assert.equal(
      decidingRecord(PUNE_RULES, read({ photoQuality: 'poor' }), UNRELIABLE).record.id,
      'gate-photo-unreadable',
    );
  });

  test('agrees with decideWith about which record won', () => {
    const cases: readonly Partial<Codes>[] = [
      {},
      { material: 'glass' },
      { contamination: 'heavy_residue' },
    ];
    for (const codes of cases) {
      const r = read(codes);
      for (const learned of [undefined, UNRELIABLE, RELIABLE]) {
        const { record, kind } = decidingRecord(PUNE_RULES, r, learned);
        const v = decideWith(PUNE_RULES, r, learned);
        assert.equal(v.rule.text, record.text);
        assert.equal(v.verdict, kind);
      }
    }
  });
});

describe('what a scan records about the model (AC-14)', () => {
  /** A usable artifact that refuses everything, so `gateFired` has something to be true about. */
  const ALWAYS_REFUSES: ModelArtifact = {
    version: 'test-v1',
    threshold: 1,
    features: [...FEATURE_NAMES],
    weights: FEATURE_NAMES.map(() => 0),
    bias: 0,
    trainedOn: { photos: 300, heldOut: 60, date: '2026-10-13' },
  };

  /** The same artifact with the one weight that makes every score a NaN. */
  const BROKEN: ModelArtifact = {
    ...ALWAYS_REFUSES,
    weights: FEATURE_NAMES.map((_, i) => (i === 0 ? Number.NaN : 0)),
  };

  test('records all three fields, so feature 5 has them named', () => {
    const r = read();
    const fields = assessWith(PUNE_RULES, r, ALWAYS_REFUSES);
    assert.deepEqual(Object.keys(fields).sort(), ['gateFired', 'modelVersion', 'trustScore']);
    assert.equal(fields.modelVersion, 'test-v1');
    assert.ok(typeof fields.trustScore === 'number');
    assert.ok(fields.trustScore >= 0 && fields.trustScore <= 1);
  });

  test('says the learned check fired only when it is what decided the read', () => {
    // It refused a read nothing written objected to, so the model is the
    // reason and the scan should say so.
    assert.equal(assessWith(PUNE_RULES, read(), ALWAYS_REFUSES).gateFired, true);

    // Same artifact, same refusal, but a written check got there first. The
    // scan must not credit the model for a refusal the rules made.
    const written = assessWith(PUNE_RULES, read({ photoQuality: 'poor' }), ALWAYS_REFUSES);
    assert.equal(written.gateFired, false);
    assert.equal(
      decideWith(PUNE_RULES, read({ photoQuality: 'poor' })).rule.text,
      textOf('gate-photo-unreadable'),
    );

    // And it still scored the read, so the number is recorded either way.
    assert.ok(typeof written.trustScore === 'number');
  });

  test('records unavailable when there is no artifact at all (AC-6)', () => {
    const fields = assessWith(PUNE_RULES, read(), undefined);
    assert.deepEqual(fields, {
      trustScore: undefined,
      modelVersion: 'unavailable',
      gateFired: false,
    });
  });

  test('records unavailable when scoring itself goes wrong (AC-6)', () => {
    // The artifact loaded, the version is real, and the arithmetic still came
    // back as not a number. A version recorded here would claim a judgment
    // that never happened.
    const fields = assessWith(PUNE_RULES, read(), BROKEN);
    assert.equal(fields.modelVersion, 'unavailable');
    assert.equal(fields.trustScore, undefined);
    assert.equal(fields.gateFired, false);
  });

  test('leaves the verdict exactly as it was whenever the model is unavailable (AC-6)', () => {
    for (const model of [undefined, BROKEN]) {
      const cases: readonly Partial<Codes>[] = [
        {},
        { material: 'glass' },
        { photoQuality: 'poor' },
        { contamination: 'light_residue' },
      ];
      for (const codes of cases) {
        const r = read(codes);
        const learned = model === undefined ? undefined : scoreWith(model, r.attributes);
        assert.equal(learned, undefined, 'this artifact was supposed to be unusable');
        assert.deepEqual(decideWith(PUNE_RULES, r, learned), decideWith(PUNE_RULES, r));
      }
    }
  });

  test('is pure, like everything else here (AC-7)', () => {
    const r = read({ recyclingSymbol: 'faded' });
    assert.deepEqual(
      assessWith(PUNE_RULES, r, ALWAYS_REFUSES),
      assessWith(PUNE_RULES, r, ALWAYS_REFUSES),
    );
  });
});

/*
 * What the verdict screen reads off a verdict, from spec 0007.
 *
 * The three fields below exist so the screen can explain itself: a band word
 * instead of a percentage, the attributes the decision actually rested on, and
 * how far the cited document's authority reaches. All three have to come from
 * the same record selection that produced the verdict, or the screen would
 * explain one decision with another's reasoning.
 */

/**
 * A rule set whose only record matches everything, so the no match backstop
 * can be reached at all.
 *
 * The real Pune set covers every material code, which `rule-set.test.ts`
 * proves, so nothing in it ever falls through. A fixture is the only way to
 * exercise the backstop, and the reason `decideWith` takes its rule set as an
 * argument at all.
 */
function bareSet(): RuleSet {
  return {
    region: 'Nowhere',
    version: 'test',
    gates: [],
    rules: [
      {
        id: 'no-match',
        when: {},
        verdict: 'checkManually',
        action: 'Check the packaging yourself',
        text: 'Nothing here covers that.',
        source: { document: 'General recycling practice', scope: 'general' },
      },
    ],
    notes: [],
  };
}

describe('the confidence band (AC-2)', () => {
  test('is the band the composed confidence falls in, not an attribute band', () => {
    // The PET rule names `material` alone, so the verdict's confidence is that
    // one score and the band follows it, whatever the other reads scored.
    assert.equal(decide(read({ material: 'pet' }, { material: 95 })).confidenceBand, 'high');
    assert.equal(decide(read({ material: 'pet' }, { material: 64 })).confidenceBand, 'medium');
  });

  test('sits on the same thresholds the proxy already uses (AC-2)', () => {
    const bandAt = (material: number) =>
      decide(read({ material: 'pet' }, { material })).confidenceBand;
    // 80 and 50, exactly as `BANDS` fixes them. The boundary belongs to the
    // band it names, so a score of exactly 80 is high, not medium.
    assert.equal(bandAt(BANDS.high), 'high');
    assert.equal(bandAt(BANDS.high - 1), 'medium');
    assert.equal(bandAt(BANDS.medium), 'medium');
  });

  test('always agrees with the number it was derived from', () => {
    const cases: readonly number[] = [0, 49, 50, 79, 80, 100];
    for (const material of cases) {
      const v = decide(read({ material: 'pet' }, { material }));
      assert.equal(v.confidenceBand, bandFor(v.confidence), `score ${material} disagreed`);
    }
  });

  test('is low where a gate refused on a weak read, never high', () => {
    // The regression this field exists to kill: the screen used to print the
    // raw percentage, so a gate firing on a 95 scoring photo quality read
    // showed "95% confident" directly beside "Check manually".
    const v = decide(read({ photoQuality: 'poor' }, { photoQuality: 20 }));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.confidenceBand, 'low');
  });
});

describe('what the decision rested on (AC-4, AC-17)', () => {
  test('names the attributes a matched rule tested, and only those', () => {
    // The PET rule names material alone; the film rule names material and form.
    assert.deepEqual(decide(read({ material: 'pet' })).decidedOn, ['material']);
    assert.deepEqual(decide(read({ material: 'pet', form: 'film' })).decidedOn, [
      'material',
      'form',
    ]);
  });

  test('names the attribute a gate stopped on, so a refusal can say what let it down', () => {
    assert.deepEqual(decide(read({ photoQuality: 'poor' })).decidedOn, ['photoQuality']);
    assert.deepEqual(decide(read({ material: 'unknown' })).decidedOn, ['material']);
    assert.deepEqual(decide(read({ construction: 'multi_material' })).decidedOn, ['construction']);
    assert.deepEqual(decide(read({ contamination: 'heavy_residue' })).decidedOn, ['contamination']);
  });

  test('is empty where the record named nothing, so the screen claims nothing', () => {
    // Both records that decide on no attribute at all. The screen reads an
    // empty list as "show no confidence chip and open all six reads".
    assert.deepEqual(decideWith(PUNE_RULES, read(), UNRELIABLE).decidedOn, []);
    assert.deepEqual(decideWith(bareSet(), read({ material: 'glass' })).decidedOn, []);
  });

  test('is in the app reading order, never the order the rule wrote them', () => {
    // `form` is declared before `material` in the film rule's condition, and
    // the screen still has to promote the rows top to bottom.
    const v = decide(read({ material: 'pp', form: 'film' }));
    assert.deepEqual(v.decidedOn, ['material', 'form']);
  });

  test('always explains the number beside it: the confidence is the weakest of exactly these', () => {
    // The invariant the whole field exists for. Whatever the read, the
    // confidence has to be the minimum over the promoted rows, so the rows the
    // screen shows are the rows the number came from.
    const cases: readonly Partial<Codes>[] = [
      { material: 'pet' },
      { material: 'pet', form: 'film' },
      { material: 'ps', form: 'foam' },
      { photoQuality: 'poor' },
      { contamination: 'heavy_residue' },
    ];
    const scores = { material: 71, form: 63, photoQuality: 55, contamination: 48 };
    for (const codes of cases) {
      const r = read(codes, scores);
      const v = decide(r);
      if (v.decidedOn.length === 0) continue;
      const weakest = Math.min(...v.decidedOn.map((key) => r.attributes[key].score));
      assert.equal(v.confidence, weakest, `${JSON.stringify(codes)} disagreed`);
    }
  });
});

describe('the authority scope (AC-6)', () => {
  test('travels out to the screen rather than being stripped off', () => {
    // It used to be dropped in `sourceFrom`, which left a national rule
    // reading on screen exactly like a municipal one.
    assert.equal(decide(read({ material: 'pet' })).rule.source.scope, 'national');
  });

  test('carries whatever the record claims, including the ones with no document', () => {
    assert.equal(decide(read({ photoQuality: 'poor' })).rule.source.scope, 'general');
    assert.equal(decide(read({ construction: 'multi_material' })).rule.source.scope, 'national');
  });

  test('marks a learned refusal as a measurement, never as law (AC-19)', () => {
    // A separate member from the four legal scopes, so no screen can render
    // the model's refusal as a rule someone published.
    const v = decideWith(PUNE_RULES, read(), UNRELIABLE);
    assert.equal(v.rule.source.scope, 'model');
  });

  test('is on every record in the shipped rule set, so no verdict can lack one', () => {
    for (const record of [...PUNE_RULES.gates, ...PUNE_RULES.rules]) {
      assert.ok(
        SOURCE_SCOPES.includes(record.source.scope),
        `${record.id} claims scope "${record.source.scope}"`,
      );
    }
  });
});

/**
 * A second opinion from the image classifier, as the proxy would send it.
 *
 * `material` is deliberately absent by default: whether the classifier's label
 * maps to a material is the proxy's business, and the engine must decide on
 * `agrees` alone. A test that had to set a material to make the gate fire
 * would be testing a coupling that does not exist.
 */
function seen(agrees: Agreement, score = 90): SecondOpinion {
  return { label: 'takeaway cups', score, agrees, modelVersion: 'recycling-net-11@v1' };
}

/** A read with a second opinion attached. */
function readSeen(agrees: Agreement, score?: number, codes: Partial<Codes> = {}): VisionRead {
  return { ...read(codes), classifier: seen(agrees, score) };
}

describe('the disagreement gate', () => {
  test('refuses a verdict the written rules would have given, when the two models conflict', () => {
    // A clean PET tub decides `recyclable` on its own. The ONLY thing changed
    // here is a confident classifier that saw a different material family.
    assert.equal(decide(read()).verdict, 'recyclable');

    const v = decide(readSeen('disagree'));
    assert.equal(v.verdict, 'checkManually');
    assert.equal(v.rule.id, DISAGREEMENT_GATE_ID);
    assert.equal(v.rule.text, textOf(DISAGREEMENT_GATE_ID));
  });

  test('cites the classifier, never a municipal or national document', () => {
    const v = decide(readSeen('disagree'));
    assert.equal(v.rule.source.scope, 'model');
    assert.match(v.rule.source.document, /Recycling-Net-11/);
    assert.equal(v.rule.source.url, undefined);
  });

  test('ignores a disagreement the classifier is not confident about', () => {
    // The floor is what stops a model that has never seen damaged Indian
    // packaging from overruling a resin code it cannot even read.
    const below = decide(readSeen('disagree', MIN_DISAGREEMENT_SCORE - 1));
    assert.equal(below.verdict, 'recyclable');

    const at = decide(readSeen('disagree', MIN_DISAGREEMENT_SCORE));
    assert.equal(at.verdict, 'checkManually', 'the threshold is inclusive');
  });

  test('treats agreement and no opinion as nothing at all', () => {
    for (const agrees of ['agree', 'no_opinion'] as const) {
      const v = decide(readSeen(agrees, 99));
      assert.equal(v.verdict, 'recyclable', `${agrees} changed the verdict`);
      assert.deepEqual(v, decide(read()), `${agrees} changed the verdict in some other way`);
    }
  });

  test('is skipped entirely when no second opinion arrived', () => {
    // The unconfigured service, the sleeping Space, the timeout and the reply
    // that would not parse all reach the engine as this one absence, and all
    // four have to behave exactly as the engine did before the classifier
    // existed (spec 0005, AC-6).
    assert.deepEqual(decide(read()), decide({ ...read(), classifier: undefined }));
  });

  test('never overrides a written stop check, however sure the classifier is', () => {
    // A poor photo is a better explanation than a model argument, and it cites
    // a document where the classifier cites only itself (spec 0005, AC-2).
    const v = decide(readSeen('disagree', 100, { photoQuality: 'poor' }));
    assert.equal(v.rule.id, 'gate-photo-unreadable');
    assert.equal(v.rule.source.scope, 'general');
  });

  test('can only ever refuse: no read is promoted by consulting it (spec 0005 AC-3)', () => {
    // The invariant the whole second opinion design exists to protect. Across
    // every material, with every agreement value, the verdict is either the one
    // the written rules reached alone or it is `checkManually`, and the
    // confidence never rises.
    //
    // Driven by the runtime vocabulary rather than a list written here, so a
    // material added to spec 0003 is covered the day it lands.
    for (const material of MATERIAL_CODES) {
      const alone = decide(read({ material }));

      for (const agrees of ['agree', 'disagree', 'no_opinion'] as const) {
        for (const score of [0, MIN_DISAGREEMENT_SCORE - 1, MIN_DISAGREEMENT_SCORE, 100]) {
          const withSecond = decide(readSeen(agrees, score, { material }));

          const unchanged = withSecond.verdict === alone.verdict;
          assert.ok(
            unchanged || withSecond.verdict === 'checkManually',
            `${material}/${agrees}/${score}: ${alone.verdict} became ${withSecond.verdict}`,
          );
          assert.ok(
            withSecond.confidence <= alone.confidence,
            `${material}/${agrees}/${score}: confidence rose from ${alone.confidence} to ${withSecond.confidence}`,
          );
        }
      }
    }
  });

  test('rests on no single read, so the screen blames no attribute for it', () => {
    // Its `when` is empty, so `decidedOn` is empty, so `blockedBy` says
    // nothing. Naming an attribute here would be blaming a read that was fine.
    const v = decide(readSeen('disagree'));
    assert.deepEqual(v.decidedOn, []);
    assert.equal(v.confidence, NO_MATCH_CONFIDENCE);
  });

  test('is reported by decidingRecord, so storage and the screen agree', () => {
    const { record, kind } = decidingRecord(PUNE_RULES, readSeen('disagree'));
    assert.equal(record.id, DISAGREEMENT_GATE_ID);
    assert.equal(kind, 'checkManually');
  });
});
