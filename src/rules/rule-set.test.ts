/**
 * Holds `pune.json` to its contract.
 *
 * JSON carries no types of its own, so `index.ts` has to cast the imported
 * file to `RuleSet`. This test is what makes that cast safe: it is the only
 * thing standing between a typo in the rule set and a rule that quietly never
 * fires in production.
 *
 * No network, no device, no quota. Run it with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { REGION } from '@/constants';
import {
  CONSTRUCTION_CODES,
  CONTAMINATION_CODES,
  FORM_CODES,
  MATERIAL_CODES,
  PHOTO_QUALITY_CODES,
  SYMBOL_CODES,
  VOCABULARY,
} from '@/vision/types';
import type {
  ConstructionCode,
  ContaminationCode,
  FormCode,
  MaterialCode,
  PhotoQualityCode,
  SymbolCode,
  VisionAttributes,
} from '@/vision/types';

import {
  DISAGREEMENT_GATE_ID,
  LEARNED_GATE_ID,
  MATERIAL_CONFIDENCE_GATE_ID,
  PUNE_RULES,
  matchFirst,
} from './index';
import type { Condition, Gate, Rule, SourceScope } from './types';

const SCOPES: readonly SourceScope[] = [
  'pune',
  'maharashtra',
  'national',
  'general',
  // Spec 0005. Not a legal scope: it marks a citation resting on the team's
  // own measurement, so nothing downstream can read it as law.
  'model',
];

/**
 * The only URLs the spec 0004 source check confirmed would load.
 *
 * A missing URL beats a dead one, so a new URL belongs here only after someone
 * has actually opened it. This list failing is the prompt to go and check.
 */
const CONFIRMED_URLS: readonly string[] = [
  'https://cpcb.nic.in/plastic-waste/',
  'https://cpcb.nic.in/rules-2/',
  'https://www.indiacode.nic.in/',
  'https://pmc.gov.in/en/solid-waste-management',
];

/**
 * Words that would tell someone which service or container to use.
 *
 * Which body collects dry waste varies by ward and this build cannot verify
 * it, so the vocabulary stays dry waste against wet waste and nothing more.
 */
const BANNED = [
  /\bbins?\b/i,
  /\bdustbins?\b/i,
  /\bkerbside\b/i,
  /\bcurbside\b/i,
  /\bswach\b/i,
  /\bpmc\b/i,
  /\bmunicipal corporation\b/i,
  /\bghanta\b/i,
  /\b(blue|green|dry|wet) (bag|box|container)\b/i,
];

const GATES = PUNE_RULES.gates;
const RULES = PUNE_RULES.rules;
const NOTES = PUNE_RULES.notes;
const CITED: readonly (Gate | Rule)[] = [...GATES, ...RULES];

/** Every attribute at full confidence, so nothing but the codes decides anything. */
function attributes(codes: {
  material: MaterialCode;
  form: FormCode;
  recyclingSymbol: SymbolCode;
  construction: ConstructionCode;
  contamination: ContaminationCode;
  photoQuality: PhotoQualityCode;
}): VisionAttributes {
  return {
    material: { code: codes.material, display: '', confidence: 'high', score: 100 },
    form: { code: codes.form, display: '', confidence: 'high', score: 100 },
    recyclingSymbol: { code: codes.recyclingSymbol, display: '', confidence: 'high', score: 100 },
    construction: { code: codes.construction, display: '', confidence: 'high', score: 100 },
    contamination: { code: codes.contamination, display: '', confidence: 'high', score: 100 },
    photoQuality: { code: codes.photoQuality, display: '', confidence: 'high', score: 100 },
  };
}

/**
 * Every combination the model can return: 14 x 5 x 4 x 3 x 4 x 3 = 10,080.
 *
 * Small enough to walk exhaustively, which is worth doing: it turns "every
 * rule is reachable" and "no material falls through" from a careful read of
 * the file into something actually proved.
 */
function everyCombination(): readonly VisionAttributes[] {
  const all: VisionAttributes[] = [];
  for (const material of MATERIAL_CODES) {
    for (const form of FORM_CODES) {
      for (const recyclingSymbol of SYMBOL_CODES) {
        for (const construction of CONSTRUCTION_CODES) {
          for (const contamination of CONTAMINATION_CODES) {
            for (const photoQuality of PHOTO_QUALITY_CODES) {
              all.push(
                attributes({
                  material,
                  form,
                  recyclingSymbol,
                  construction,
                  contamination,
                  photoQuality,
                }),
              );
            }
          }
        }
      }
    }
  }
  return all;
}

const COMBINATIONS = everyCombination();

/** Mirrors the engine: a gate fires on its condition, or on the score threshold. */
function gateReaches(a: VisionAttributes): boolean {
  return GATES.some(
    (g) =>
      matchFirst([g], a) !== undefined ||
      (g.id === MATERIAL_CONFIDENCE_GATE_ID && a.material.score < 50),
  );
}

describe('the rule set', () => {
  test('is for the region this build ships, and carries a version (AC-2)', () => {
    assert.equal(PUNE_RULES.region, REGION.label);
    assert.ok(PUNE_RULES.version.length > 0, 'version must not be empty');
  });

  test('has the stop checks in the order the specs declare (AC-4, spec 0005 AC-2)', () => {
    assert.deepEqual(
      GATES.map((g) => g.id),
      [
        'gate-photo-unreadable',
        MATERIAL_CONFIDENCE_GATE_ID,
        'gate-multi-material',
        'gate-heavy-residue',
        // The two model driven checks come last, and position in this array is
        // the only thing enforcing it. A read halted by any written check above
        // never reaches either model, and moving these lines would break that
        // quietly, which is why the order is asserted whole rather than by
        // membership.
        //
        // The disagreement check sits ahead of the learned one because it is
        // the one that can fire today: it needs only the classifier's answer,
        // while the learned gate waits on a trained artifact that is still a
        // stub. Between two model citations either order is defensible; what
        // may never move is their position behind the four written checks.
        DISAGREEMENT_GATE_ID,
        LEARNED_GATE_ID,
      ],
    );
  });

  test('keeps the learned check last, after every written one (spec 0005 AC-2, AC-5)', () => {
    assert.equal(GATES[GATES.length - 1].id, LEARNED_GATE_ID);
    // Its `when` is empty, so `matches` alone would fire it on every read. The
    // engine special cases it by id; if it ever stopped being the only empty
    // condition among the gates, a written check would start firing on
    // everything.
    assert.deepEqual(GATES[GATES.length - 1].when, {});
    assert.deepEqual(
      GATES.filter((g) => Object.keys(g.when).length === 0).map((g) => g.id),
      [DISAGREEMENT_GATE_ID, LEARNED_GATE_ID],
      'only the two model driven checks may have an empty condition',
    );
  });

  test('cites the learned check to the model, never to a document (spec 0005 AC-4)', () => {
    const learned = GATES.find((g) => g.id === LEARNED_GATE_ID);
    assert.ok(learned !== undefined, `no gate with id ${LEARNED_GATE_ID}`);
    assert.equal(learned.source.scope, 'model');
    // It is the one citation with no document behind it, so it has to name the
    // measurement instead. `index.ts` fills the counts in from the artifact;
    // an unfilled placeholder here means that binding stopped happening.
    assert.match(learned.source.document, /held out/);
    assert.ok(!/[{}]/.test(learned.source.document), 'citation placeholder was never filled');
    assert.equal(learned.source.url, undefined, 'a model citation has no page to link to');
  });

  test('gives a model no say anywhere but its own gate (spec 0005 AC-4)', () => {
    const scoped = CITED.filter((r) => r.source.scope === 'model');
    assert.deepEqual(
      scoped.map((r) => r.id),
      [DISAGREEMENT_GATE_ID, LEARNED_GATE_ID],
      'only a stop check may cite a model, and never a rule that decides a verdict',
    );
  });

  test('cites the disagreement check to the classifier, with no page to link to', () => {
    const gate = GATES.find((g) => g.id === DISAGREEMENT_GATE_ID);
    assert.ok(gate !== undefined, `no gate with id ${DISAGREEMENT_GATE_ID}`);
    assert.equal(gate.source.scope, 'model');
    // It has to name which model disagreed. A citation reading "a model" tells
    // the reader nothing they could go and check.
    assert.match(gate.source.document, /Recycling-Net-11/);
    // Same rule as the learned gate: a model citation rests on a measurement,
    // not on a document, so there is no page that would back it up.
    assert.equal(gate.source.url, undefined, 'a model citation has no page to link to');
  });

  test('keeps the gate the engine finds by id (AC-4)', () => {
    // The score threshold cannot be written as a condition, so the engine has
    // to find its gate by id. If this id ever stops matching, that check goes
    // quietly dead and a low confidence material would be decided on.
    assert.ok(
      GATES.some((g) => g.id === MATERIAL_CONFIDENCE_GATE_ID),
      `no gate with id ${MATERIAL_CONFIDENCE_GATE_ID}`,
    );
  });

  test('gives every record an id of its own (AC-12)', () => {
    const ids = [...GATES, ...RULES, ...NOTES].map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate id in ${ids.join(', ')}`);
  });

  test('names only attributes and codes spec 0003 declares (AC-12)', () => {
    const conditions: readonly { id: string; when: Condition }[] = [...CITED, ...NOTES];
    for (const { id, when } of conditions) {
      for (const [key, codes] of Object.entries(when)) {
        const vocabulary = (VOCABULARY as Record<string, readonly string[] | undefined>)[key];
        assert.ok(vocabulary, `${id}: "${key}" is not one of the six attributes`);
        assert.ok(Array.isArray(codes) && codes.length > 0, `${id}: "${key}" names no codes`);
        for (const code of codes as readonly string[]) {
          assert.ok(vocabulary.includes(code), `${id}: "${code}" is not a valid ${key}`);
        }
      }
    }
  });

  test('explains every gate and rule in plain words, with a document behind it (AC-3)', () => {
    for (const record of CITED) {
      assert.ok(record.text.trim().length > 0, `${record.id}: empty text`);
      assert.ok(record.action.trim().length > 0, `${record.id}: empty action`);
      assert.ok(record.source.document.trim().length > 0, `${record.id}: empty document`);
    }
    for (const note of NOTES) {
      assert.ok(note.text.trim().length > 0, `${note.id}: empty text`);
    }
  });

  test('declares how far every citation reaches (AC-15)', () => {
    for (const record of CITED) {
      assert.ok(
        SCOPES.includes(record.source.scope),
        `${record.id}: "${record.source.scope}" is not a declared scope`,
      );
    }
  });

  test('claims no Pune scope, because no Pune document could be obtained (AC-15)', () => {
    // Not a permanent truth, a current one. The spec 0004 source check could
    // not load one quotable PMC or SWaCH document, so every rule here rests on
    // the national Rules or on stated general practice. If you obtain a real
    // Pune document, cite it, claim `pune`, and delete this test.
    const claimed = CITED.filter((r) => r.source.scope === 'pune');
    assert.deepEqual(
      claimed.map((r) => r.id),
      [],
      'a rule claims pune scope: name the Pune document behind it',
    );
  });

  test('links only to pages someone confirmed would load (AC-3)', () => {
    for (const record of CITED) {
      if (record.source.url === undefined) continue;
      assert.ok(
        CONFIRMED_URLS.includes(record.source.url),
        `${record.id}: ${record.source.url} was never confirmed to load`,
      );
    }
  });

  test('never names a collection service or a container (AC-13)', () => {
    const wording = [
      ...CITED.flatMap((r) => [
        { id: r.id, s: r.text },
        { id: r.id, s: r.action },
      ]),
      ...NOTES.map((n) => ({ id: n.id, s: n.text })),
    ];
    for (const { id, s } of wording) {
      for (const banned of BANNED) {
        assert.ok(!banned.test(s), `${id}: "${s}" matches ${banned}`);
      }
    }
  });

  test('ends with the no match record, which matches everything (AC-7)', () => {
    const last = RULES[RULES.length - 1];
    assert.equal(last.id, 'no-match');
    assert.deepEqual(last.when, {}, 'the no match record must name no attribute');
    assert.equal(last.verdict, 'checkManually');
    // The engine falls back to this record positionally, so it has to be last.
    assert.equal(
      RULES.filter((r) => Object.keys(r.when).length === 0).length,
      1,
      'only the no match record may have an empty condition',
    );
  });

  test('reaches every material code, so none falls through by accident (AC-6)', () => {
    const fellThrough = new Set<string>();
    for (const a of COMBINATIONS) {
      if (gateReaches(a)) continue;
      const rule = matchFirst(RULES, a);
      if (rule === undefined || rule.id === 'no-match') fellThrough.add(a.material.code);
    }
    assert.deepEqual([...fellThrough], [], 'material codes with no rule and no gate');
  });

  test('can reach every rule it declares (AC-5)', () => {
    const reached = new Set<string>();
    for (const a of COMBINATIONS) {
      const rule = matchFirst(RULES, a);
      if (rule !== undefined) reached.add(rule.id);
    }
    // `no-match` is exempt, and the AC-6 test above is exactly why: every
    // material code is covered, so nothing reaches the backstop today. It
    // stays in the file so that removing a rule tomorrow degrades to an
    // honest "check manually" rather than to a crash.
    const shouldBeReachable = RULES.filter((r) => r.id !== 'no-match').map((r) => r.id);
    const dead = shouldBeReachable.filter((id) => !reached.has(id));
    assert.deepEqual(dead, [], 'these rules can never fire: an earlier rule already covers them');
  });

  test('can reach every note it declares', () => {
    const reached = new Set<string>();
    for (const a of COMBINATIONS) {
      const note = matchFirst(NOTES, a);
      if (note !== undefined) reached.add(note.id);
    }
    const dead = NOTES.map((n) => n.id).filter((id) => !reached.has(id));
    assert.deepEqual(dead, [], 'these notes can never show');
  });

  /*
   * Since spec 0006 every saved scan stores `rule_id`, which turns an id from
   * a label into a durable reference. Two records sharing one would leave a
   * stored scan unable to say which of them actually decided it, and the three
   * lists share a single namespace because the column does not record which
   * list the id came from.
   */
  test('gives every gate, rule and note an id of its own', () => {
    const ids = [
      ...PUNE_RULES.gates.map((g) => g.id),
      ...PUNE_RULES.rules.map((r) => r.id),
      ...PUNE_RULES.notes.map((n) => n.id),
    ];

    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }

    assert.deepEqual(duplicates, [], 'these ids appear more than once');
    assert.deepEqual(
      ids.filter((id) => id.trim().length === 0),
      [],
      'every record needs an id that is not blank',
    );
  });
});
