/**
 * The vocabulary's own tests. No network, no quota.
 *
 * These cover the parts of spec 0003 that are pure functions: what the
 * validator accepts, where a score becomes a band, and what normalising does
 * to the text and to an `unknown` code.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ATTRIBUTE_KEYS,
  BANDS,
  CODES,
  bandFor,
  cap,
  geminiJsonSchema,
  geminiReplySchema,
  normalise,
  TEXT_CAPS,
  type FoundReply,
} from './schema';

/** A complete, valid model reply. Tests bend one field at a time off this. */
function validReply(): Record<string, unknown> {
  return {
    packagingFound: true,
    itemName: 'Yogurt tub',
    note: 'The symbol was faded, so the material was judged from the shape too.',
    attributes: {
      material: { code: 'pp', display: 'Polypropylene, code 5', score: 88 },
      form: { code: 'rigid', display: 'Rigid, holds its shape', score: 91 },
      recyclingSymbol: { code: 'faded', display: 'Found, partly faded', score: 74 },
      construction: { code: 'single_material', display: 'Single material', score: 91 },
      contamination: { code: 'light_residue', display: 'A little left inside', score: 66 },
      photoQuality: { code: 'good', display: 'Sharp and well lit', score: 95 },
    },
  };
}

function parseFound(raw: Record<string, unknown>): FoundReply {
  const parsed = geminiReplySchema.parse(raw);
  assert.equal(parsed.packagingFound, true, 'fixture should be the packagingFound branch');
  return parsed as FoundReply;
}

describe('bandFor', () => {
  // The four boundaries spec 0003 names, plus the ends of the range.
  const cases: [number, string][] = [
    [0, 'low'],
    [49, 'low'],
    [50, 'medium'],
    [79, 'medium'],
    [80, 'high'],
    [100, 'high'],
  ];

  for (const [score, expected] of cases) {
    it(`maps ${score} to ${expected}`, () => {
      assert.equal(bandFor(score), expected);
    });
  }

  it('bands at the documented thresholds', () => {
    assert.deepEqual(BANDS, { high: 80, medium: 50 });
  });
});

describe('the validator', () => {
  it('accepts a complete reply', () => {
    assert.equal(geminiReplySchema.safeParse(validReply()).success, true);
  });

  it('accepts packagingFound false on its own', () => {
    const parsed = geminiReplySchema.safeParse({ packagingFound: false });
    assert.equal(parsed.success, true);
  });

  it('accepts a reply with no note', () => {
    const reply = validReply();
    delete reply.note;
    assert.equal(geminiReplySchema.safeParse(reply).success, true);
  });

  it('rejects a code outside the enum', () => {
    const reply = validReply();
    (reply.attributes as Record<string, unknown>).material = {
      code: 'unobtainium',
      display: 'Something new',
      score: 80,
    };
    assert.equal(geminiReplySchema.safeParse(reply).success, false);
  });

  it('rejects an unknown code on photoQuality, which has no unknown', () => {
    const reply = validReply();
    (reply.attributes as Record<string, unknown>).photoQuality = {
      code: 'unknown',
      display: 'Could not tell',
      score: 20,
    };
    assert.equal(geminiReplySchema.safeParse(reply).success, false);
  });

  it('rejects a display that is empty after trimming', () => {
    const reply = validReply();
    (reply.attributes as Record<string, unknown>).material = {
      code: 'pp',
      display: '   ',
      score: 80,
    };
    assert.equal(geminiReplySchema.safeParse(reply).success, false);
  });

  it('accepts an overlong display rather than failing the whole read', () => {
    const reply = validReply();
    (reply.attributes as Record<string, unknown>).material = {
      code: 'pp',
      display: 'x'.repeat(90),
      score: 80,
    };
    assert.equal(geminiReplySchema.safeParse(reply).success, true);
  });

  it('rejects a missing attribute', () => {
    const reply = validReply();
    delete (reply.attributes as Record<string, unknown>).contamination;
    assert.equal(geminiReplySchema.safeParse(reply).success, false);
  });

  it('rejects packagingFound true with no attributes at all', () => {
    assert.equal(
      geminiReplySchema.safeParse({ packagingFound: true, itemName: 'Tub' }).success,
      false,
    );
  });

  it('rejects a score that is not a whole number in range', () => {
    for (const score of [-1, 101, 55.5, '80']) {
      const reply = validReply();
      (reply.attributes as Record<string, unknown>).material = {
        code: 'pp',
        display: 'Polypropylene',
        score,
      };
      assert.equal(geminiReplySchema.safeParse(reply).success, false, `score ${score}`);
    }
  });

  it('rejects an itemName that is empty after trimming', () => {
    assert.equal(geminiReplySchema.safeParse({ ...validReply(), itemName: ' ' }).success, false);
  });
});

describe('normalise', () => {
  it('derives a band for every attribute and keeps the score', () => {
    const read = normalise(parseFound(validReply()));

    assert.equal(read.attributes.material.confidence, 'high');
    assert.equal(read.attributes.material.score, 88);
    assert.equal(read.attributes.recyclingSymbol.confidence, 'medium');
    assert.equal(read.attributes.recyclingSymbol.score, 74);
    assert.equal(read.attributes.contamination.confidence, 'medium');
  });

  it('forces an unknown code to low while the score travels unchanged', () => {
    const reply = validReply();
    (reply.attributes as Record<string, unknown>).material = {
      code: 'unknown',
      display: 'Could not tell',
      score: 85,
    };

    const read = normalise(parseFound(reply));

    assert.equal(read.attributes.material.code, 'unknown');
    assert.equal(read.attributes.material.confidence, 'low');
    assert.equal(read.attributes.material.score, 85, 'feature 4 still needs the number');
  });

  it('truncates an overlong display to the cap', () => {
    const reply = validReply();
    (reply.attributes as Record<string, unknown>).material = {
      code: 'pp',
      display: 'x'.repeat(90),
      score: 80,
    };

    const read = normalise(parseFound(reply));
    assert.equal(read.attributes.material.display.length, TEXT_CAPS.display);
  });

  it('truncates itemName and note to their own caps', () => {
    const read = normalise(
      parseFound({ ...validReply(), itemName: 'y'.repeat(80), note: 'z'.repeat(200) }),
    );

    assert.equal(read.itemName.length, TEXT_CAPS.itemName);
    assert.equal(read.note?.length, TEXT_CAPS.note);
  });

  it('trims surrounding whitespace off the text fields', () => {
    const reply = validReply();
    reply.itemName = '  Yogurt tub  ';
    (reply.attributes as Record<string, unknown>).material = {
      code: 'pp',
      display: '\n Polypropylene \n',
      score: 80,
    };

    const read = normalise(parseFound(reply));

    assert.equal(read.itemName, 'Yogurt tub');
    assert.equal(read.attributes.material.display, 'Polypropylene');
  });

  it('leaves note off entirely when the model sent none', () => {
    const reply = validReply();
    delete reply.note;

    const read = normalise(parseFound(reply));
    assert.equal('note' in read, false);
  });

  it('never carries packagingFound into the wire shape', () => {
    const read = normalise(parseFound(validReply()));
    assert.equal('packagingFound' in read, false);
  });
});

describe('cap', () => {
  it('leaves a short string alone', () => {
    assert.equal(cap('short', 60), 'short');
  });

  it('does not leave a trailing space behind after cutting', () => {
    assert.equal(cap('abcde fghij', 6), 'abcde');
  });
});

describe('the schema handed to Gemini', () => {
  it('offers both halves of the packagingFound union', () => {
    const schema = geminiJsonSchema() as { anyOf: Record<string, unknown>[] };

    assert.equal(schema.anyOf.length, 2);
    for (const branch of schema.anyOf) {
      assert.ok((branch.required as string[]).includes('packagingFound'));
    }
  });

  it('carries exactly the codes CODES declares, so the two cannot drift', () => {
    const schema = geminiJsonSchema() as { anyOf: Record<string, any>[] };
    const attributes = schema.anyOf[1].properties.attributes.properties;

    assert.deepEqual(Object.keys(attributes), [...ATTRIBUTE_KEYS]);
    for (const key of ATTRIBUTE_KEYS) {
      assert.deepEqual(attributes[key].properties.code.enum, [...CODES[key]]);
    }
  });

  it('requires every attribute on the branch that found packaging', () => {
    const schema = geminiJsonSchema() as { anyOf: Record<string, any>[] };
    assert.deepEqual(schema.anyOf[1].properties.attributes.required, [...ATTRIBUTE_KEYS]);
  });

  it('gives the model nowhere to put a verdict', () => {
    const schema = geminiJsonSchema() as { anyOf: Record<string, any>[] };
    const found = schema.anyOf[1].properties;

    // Four fields and no fifth. There is no field a recyclability judgement,
    // a bin name or a piece of advice could arrive in, which is what makes
    // AC-6 structural rather than a matter of the model behaving itself.
    assert.deepEqual(Object.keys(found), ['packagingFound', 'itemName', 'note', 'attributes']);

    for (const key of ATTRIBUTE_KEYS) {
      assert.deepEqual(Object.keys(found.attributes.properties[key].properties), [
        'code',
        'display',
        'score',
      ]);
    }
  });
});
