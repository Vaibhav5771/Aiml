/**
 * The data layer's logic, proved with no device and no database.
 *
 * Everything worth testing about storage is in `map.ts`: the round trip, the
 * tolerant reader, and the projection that stops a score reaching a screen.
 * `index.ts` holds the SQL and the file system and has no logic to test, which
 * is the whole reason the split exists (spec 0006, AC-15).
 *
 * Run it with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { UNAVAILABLE_VERSION } from '@/ml/types';
import type { ScanLearnedFields, StoredScan, Verdict, VisionRead } from '@/vision/types';

import {
  SCAN_COLUMNS,
  buildScan,
  fromRow,
  photoFileName,
  readAttributes,
  toDisplayScan,
  toRow,
  toSummary,
  type ScanRow,
} from './map';
import { ATTRIBUTES_PAYLOAD_VERSION } from './schema';
import { isFailure } from './types';

const READ: VisionRead = {
  itemName: 'Yogurt tub',
  attributes: {
    material: { code: 'pp', display: 'Polypropylene, code 5', confidence: 'high', score: 91 },
    form: { code: 'rigid', display: 'Rigid, holds its shape', confidence: 'high', score: 88 },
    recyclingSymbol: {
      code: 'faded',
      display: 'Found, partly faded',
      confidence: 'medium',
      score: 64,
    },
    construction: {
      code: 'single_material',
      display: 'Single material',
      confidence: 'high',
      score: 86,
    },
    contamination: {
      code: 'light_residue',
      display: 'A little yogurt left inside',
      confidence: 'medium',
      score: 59,
    },
    photoQuality: { code: 'good', display: 'Sharp and well lit', confidence: 'high', score: 93 },
  },
};

const VERDICT: Verdict = {
  verdict: 'recyclable',
  action: 'Dry waste, rinse it first',
  confidence: 59,
  confidenceBand: 'medium',
  decidedOn: ['material', 'contamination'],
  rule: {
    id: 'rule-pp',
    text: 'Rigid polypropylene, resin code 5, is a recyclable plastic.',
    source: {
      document: 'Plastic Waste Management Rules, 2016 (India)',
      scope: 'national',
      url: 'https://cpcb.nic.in/plastic-waste/',
    },
  },
  note: 'The symbol was faded, so the material was judged from the shape too.',
};

const LEARNED: ScanLearnedFields = {
  trustScore: 0.82,
  modelVersion: 'v1',
  gateFired: false,
};

const SCANNED_AT = Date.parse('2026-10-13T09:30:00.000Z');

function sampleScan(): StoredScan {
  return buildScan({
    id: 'abc-123',
    scannedAt: SCANNED_AT,
    photoUri: 'file:///documents/scans/abc-123.jpg',
    read: READ,
    verdict: VERDICT,
    learned: LEARNED,
    ruleSet: { region: 'Pune, India', version: '1.1.0' },
  });
}

/** A row as SQLite would hand it back, built through the real writer. */
function sampleRow(): ScanRow {
  return toRow(sampleScan());
}

describe('building a scan', () => {
  test('takes every field from the pipeline that produced it', () => {
    const scan = sampleScan();

    assert.equal(scan.id, 'abc-123');
    assert.equal(scan.itemName, 'Yogurt tub');
    assert.equal(scan.scannedAt, '2026-10-13T09:30:00.000Z');
    assert.equal(scan.region, 'Pune, India');
    assert.equal(scan.ruleSetVersion, '1.1.0');
    assert.equal(scan.verdict, 'recyclable');
    assert.equal(scan.rule.id, 'rule-pp');
    assert.equal(scan.trustScore, 0.82);
    assert.equal(scan.modelVersion, 'v1');
    assert.equal(scan.gateFired, false);
  });

  test('keeps the raw scores, which feature 13 needs', () => {
    const scan = sampleScan();
    assert.equal(scan.attributes.material?.score, 91);
    assert.equal(scan.attributes.photoQuality?.score, 93);
  });
});

describe('the round trip', () => {
  test('returns exactly what went in', () => {
    const before = sampleScan();
    const after = fromRow(toRow(before));

    assert.ok(!isFailure(after));
    assert.deepEqual(after.value, before);
  });

  test('stamps the payload with the version this build writes', () => {
    assert.equal(sampleRow().attributes_version, ATTRIBUTES_PAYLOAD_VERSION);
  });

  test('stores the time as epoch milliseconds and reads it back as ISO', () => {
    const row = sampleRow();
    assert.equal(row.scanned_at, SCANNED_AT);
    assert.equal(typeof row.scanned_at, 'number');

    const back = fromRow(row);
    assert.ok(!isFailure(back));
    assert.equal(back.value.scannedAt, '2026-10-13T09:30:00.000Z');
  });

  test('writes a boolean as 0 or 1, because SQLite has no boolean', () => {
    assert.equal(toRow({ ...sampleScan(), gateFired: true }).gate_fired, 1);
    assert.equal(toRow({ ...sampleScan(), gateFired: false }).gate_fired, 0);
  });

  test('tells an absent note apart from an empty one', () => {
    const { note: _dropped, ...withoutNote } = sampleScan();
    const row = toRow(withoutNote);
    assert.equal(row.note, null);

    const back = fromRow(row);
    assert.ok(!isFailure(back));
    assert.equal('note' in back.value, false);
  });

  test('keeps a name only citation as an absent url, never a null one', () => {
    const scan = sampleScan();
    const nameOnly: StoredScan = {
      ...scan,
      rule: { ...scan.rule, source: { document: 'General recycling practice' } },
    };

    const row = toRow(nameOnly);
    assert.equal(row.rule_source_url, null);

    const back = fromRow(row);
    assert.ok(!isFailure(back));
    assert.equal('url' in back.value.rule.source, false);
  });

  test('turns a null trust score back into undefined, meaning never consulted', () => {
    const scan = sampleScan();
    const unjudged: StoredScan = {
      ...scan,
      trustScore: undefined,
      modelVersion: UNAVAILABLE_VERSION,
    };

    const row = toRow(unjudged);
    assert.equal(row.trust_score, null);
    assert.equal(row.model_version, UNAVAILABLE_VERSION);

    const back = fromRow(row);
    assert.ok(!isFailure(back));
    assert.equal(back.value.trustScore, undefined);
  });
});

describe('the tolerant reader', () => {
  /*
   * This is the test feature 5 exists for. A payload written before an
   * attribute existed must still open, and the missing attribute must come
   * back absent rather than invented. `photoQuality` is used deliberately:
   * its code union has no `unknown` member, so there is no value a reader
   * could honestly substitute even if it wanted to.
   */
  test('opens a payload written without a key, and reports that key absent', () => {
    const row = sampleRow();
    const payload = JSON.parse(row.attributes) as Record<string, unknown>;
    delete payload.photoQuality;

    const back = fromRow({ ...row, attributes: JSON.stringify(payload) });

    assert.ok(!isFailure(back));
    assert.equal(back.value.attributes.photoQuality, undefined);
    assert.equal('photoQuality' in back.value.attributes, false);
    // Everything else survived, so one missing key costs one row and not the scan.
    assert.equal(back.value.attributes.material?.code, 'pp');
    assert.equal(Object.keys(back.value.attributes).length, 5);
  });

  test('ignores a key written by a later build that this one has never heard of', () => {
    const payload = JSON.parse(sampleRow().attributes) as Record<string, unknown>;
    payload.labelPrinting = {
      code: 'direct',
      display: 'Printed on',
      confidence: 'high',
      score: 70,
    };

    const attributes = readAttributes(JSON.stringify(payload), ATTRIBUTES_PAYLOAD_VERSION);

    assert.ok(attributes !== undefined);
    assert.equal(Object.keys(attributes).length, 6);
    assert.equal('labelPrinting' in attributes, false);
  });

  test('keeps a code this build does not know, because the screen renders the words', () => {
    const payload = JSON.parse(sampleRow().attributes) as Record<string, unknown>;
    payload.material = {
      code: 'bioplastic_pla',
      display: 'Plant based plastic',
      confidence: 'medium',
      score: 55,
    };

    const attributes = readAttributes(JSON.stringify(payload), ATTRIBUTES_PAYLOAD_VERSION);

    assert.ok(attributes !== undefined);
    assert.equal(attributes.material?.display, 'Plant based plastic');
  });

  test('drops an attribute that is not shaped like a read', () => {
    const payload = JSON.parse(sampleRow().attributes) as Record<string, unknown>;
    payload.form = { code: 'rigid', display: 'Rigid' }; // no confidence, no score

    const attributes = readAttributes(JSON.stringify(payload), ATTRIBUTES_PAYLOAD_VERSION);

    assert.ok(attributes !== undefined);
    assert.equal(attributes.form, undefined);
    assert.equal(attributes.material?.code, 'pp');
  });

  test('refuses a payload version it does not know, rather than misreading it', () => {
    assert.equal(readAttributes(sampleRow().attributes, 99), undefined);

    const back = fromRow({ ...sampleRow(), attributes_version: 99 });
    assert.ok(isFailure(back));
    assert.equal(back.error, 'row_unreadable');
  });

  test('refuses a payload that is not valid JSON', () => {
    assert.equal(readAttributes('{not json', ATTRIBUTES_PAYLOAD_VERSION), undefined);

    const back = fromRow({ ...sampleRow(), attributes: 'null' });
    assert.ok(isFailure(back));
    assert.equal(back.error, 'row_unreadable');
  });

  test('refuses a verdict that is not one of the three', () => {
    const back = fromRow({ ...sampleRow(), verdict: 'probably_fine' });
    assert.ok(isFailure(back));
    assert.equal(back.error, 'row_unreadable');
  });
});

describe('the display projection', () => {
  test('drops every score at runtime, not just in the type', () => {
    const display = toDisplayScan(sampleScan());

    for (const attribute of Object.values(display.attributes)) {
      assert.equal('score' in attribute, false);
    }
  });

  test('keeps everything a screen actually shows', () => {
    const display = toDisplayScan(sampleScan());

    assert.equal(display.attributes.material?.code, 'pp');
    assert.equal(display.attributes.material?.display, 'Polypropylene, code 5');
    assert.equal(display.attributes.material?.confidence, 'high');
    assert.equal(display.rule.id, 'rule-pp');
    assert.equal(display.confidence, 59);
  });

  test('carries an absent attribute through as absent', () => {
    const scan = sampleScan();
    const partial: StoredScan = {
      ...scan,
      attributes: { ...scan.attributes, photoQuality: undefined },
    };

    const display = toDisplayScan(partial);
    assert.equal(display.attributes.photoQuality, undefined);
    assert.equal(Object.keys(display.attributes).length, 5);
  });
});

describe('the summary', () => {
  test('reads the six columns the history list shows', () => {
    const row = sampleRow();
    const summary = toSummary(row);

    assert.deepEqual(summary, {
      id: 'abc-123',
      photoUri: 'file:///documents/scans/abc-123.jpg',
      itemName: 'Yogurt tub',
      scannedAt: '2026-10-13T09:30:00.000Z',
      verdict: 'recyclable',
      confidence: 59,
    });
  });

  test('degrades an unrecognised verdict to check manually, never to a claim', () => {
    assert.equal(toSummary({ ...sampleRow(), verdict: 'probably_fine' }).verdict, 'checkManually');
  });
});

describe('the photo file name', () => {
  test('is the scan id', () => {
    assert.equal(photoFileName('abc-123'), 'abc-123.jpg');
  });
});

describe('the column list', () => {
  /*
   * The insert builds both halves of its statement from `SCAN_COLUMNS`, so a
   * column missing from that list would silently never be written. The type
   * catches a misspelling; only this catches an omission.
   */
  test('covers every column a row carries', () => {
    assert.deepEqual([...SCAN_COLUMNS].sort(), Object.keys(sampleRow()).sort());
  });
});

/*
 * The two columns `MIGRATIONS[1]` added, from spec 0007.
 *
 * The forward compatibility story spec 0006 rests on gets its first real test
 * here: this is the first migration to land on a table that already has rows
 * in it, so a row written before these columns existed has to keep opening.
 */

/** A row exactly as a build before `MIGRATIONS[1]` would have left it. */
function preMigrationRow(): ScanRow {
  return { ...sampleRow(), rule_source_scope: null, decided_on: null };
}

describe('the authority scope (AC-12, AC-18)', () => {
  test('makes the round trip', () => {
    const row = sampleRow();
    assert.equal(row.rule_source_scope, 'national');

    const result = fromRow(row);
    assert.ok(!isFailure(result));
    assert.equal(result.value.rule.source.scope, 'national');
  });

  test('opens a row written before the column existed, with no scope at all', () => {
    // The whole of AC-18. No error, and the key absent rather than null, so
    // the screen shows no authority chip rather than an empty one.
    const result = fromRow(preMigrationRow());
    assert.ok(!isFailure(result));
    assert.ok(!('scope' in result.value.rule.source));
  });

  test('refuses a scope this build does not recognise, rather than passing it on', () => {
    // It could only come from a later build. A chip is a claim about how far a
    // rule reaches, and there is nothing here to back one.
    const result = fromRow({ ...sampleRow(), rule_source_scope: 'galactic' });
    assert.ok(!isFailure(result));
    assert.equal(result.value.rule.source.scope, undefined);
  });

  test('keeps the citation itself whatever happens to the scope', () => {
    // Losing the chip must never cost the document. Invariant 3 of spec 0007:
    // there is no state with an answer and no citation.
    const result = fromRow(preMigrationRow());
    assert.ok(!isFailure(result));
    assert.equal(result.value.rule.source.document, 'Plastic Waste Management Rules, 2016 (India)');
    assert.equal(result.value.rule.source.url, 'https://cpcb.nic.in/plastic-waste/');
  });
});

describe('what the decision rested on (AC-12, AC-18)', () => {
  test('makes the round trip as JSON', () => {
    const row = sampleRow();
    assert.equal(row.decided_on, '["material","contamination"]');

    const result = fromRow(row);
    assert.ok(!isFailure(result));
    assert.deepEqual(result.value.decidedOn, ['material', 'contamination']);
  });

  test('reads a row written before the column as deciding on nothing', () => {
    // Which is the same treatment the learned gate and the no match rule
    // already get, so AC-18 needs no special case: no promoted rows, and all
    // six reads open.
    const result = fromRow(preMigrationRow());
    assert.ok(!isFailure(result));
    assert.deepEqual(result.value.decidedOn, []);
  });

  test('is stored, not recomputed, so an edited rule set cannot rewrite history', () => {
    // The deliberate exception to the rule against storing a derived value.
    // The row says what decided it; nothing re-reads `pune.json` to find out.
    const row = { ...sampleRow(), decided_on: '["photoQuality"]' };
    const result = fromRow(row);
    assert.ok(!isFailure(result));
    assert.deepEqual(result.value.decidedOn, ['photoQuality']);
  });

  test('survives a payload that is not a list of keys', () => {
    for (const decided_on of ['not json', '{"material":true}', 'null', '[42]']) {
      const result = fromRow({ ...sampleRow(), decided_on });
      assert.ok(!isFailure(result), `${decided_on} should still open`);
      assert.deepEqual(result.value.decidedOn, [], `${decided_on} invented a key`);
    }
  });

  test('drops a key this build has never heard of', () => {
    const result = fromRow({ ...sampleRow(), decided_on: '["material","barcode"]' });
    assert.ok(!isFailure(result));
    assert.deepEqual(result.value.decidedOn, ['material']);
  });

  test('comes back in the app reading order, whatever order the row wrote', () => {
    const result = fromRow({ ...sampleRow(), decided_on: '["contamination","material"]' });
    assert.ok(!isFailure(result));
    assert.deepEqual(result.value.decidedOn, ['material', 'contamination']);
  });
});

describe('the confidence band (AC-2)', () => {
  test('is derived on the way out, never read from a column', () => {
    // Deliberately not stored: `bandFor` over the stored number gives the same
    // answer, and a stored copy would be a second source of truth that can
    // disagree with the first.
    const result = fromRow({ ...sampleRow(), confidence: 59 });
    assert.ok(!isFailure(result));
    assert.equal(result.value.confidenceBand, 'medium');
    assert.ok(!('confidence_band' in sampleRow()));
  });

  test('bands an old row exactly as it banded on the day, because the thresholds are fixed', () => {
    const cases: readonly [number, string][] = [
      [100, 'high'],
      [80, 'high'],
      [79, 'medium'],
      [50, 'medium'],
      [49, 'low'],
      [0, 'low'],
    ];
    for (const [confidence, band] of cases) {
      const result = fromRow({ ...sampleRow(), confidence });
      assert.ok(!isFailure(result));
      assert.equal(result.value.confidenceBand, band, `${confidence} banded wrong`);
    }
  });

  test('survives the projection to a display scan', () => {
    const result = fromRow(sampleRow());
    assert.ok(!isFailure(result));
    const display = toDisplayScan(result.value);
    assert.equal(display.confidenceBand, result.value.confidenceBand);
    assert.deepEqual(display.decidedOn, result.value.decidedOn);
  });
});
