/**
 * Holds `parseVisionRead` to the spec 0003 contract.
 *
 * This is the app's last line against a proxy that drifted, so the cases that
 * matter most are the near misses: a code that is almost right, a score just
 * outside the range, an attribute that is simply absent. A validator that
 * passes those is worse than none, because it would hand the rule engine a
 * read the engine has no reason to doubt.
 *
 * No network, no device, no quota. Run it with `npm test`.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { parseVisionRead } from './validate';

/** One attribute valid in every respect, so each test can break exactly one thing. */
const attribute = (code: string, overrides: Record<string, unknown> = {}) => ({
  code,
  display: 'A plain line',
  confidence: 'high',
  score: 90,
  ...overrides,
});

/** A whole valid body. Spread over it to make exactly one field wrong. */
function body(overrides: Record<string, unknown> = {}): unknown {
  return {
    itemName: 'Yogurt tub',
    attributes: {
      material: attribute('pp'),
      form: attribute('rigid'),
      recyclingSymbol: attribute('faded', { confidence: 'medium', score: 61 }),
      construction: attribute('single_material'),
      contamination: attribute('light_residue', { confidence: 'medium', score: 55 }),
      photoQuality: attribute('good'),
    },
    ...overrides,
  };
}

/** Replace one attribute, keeping the other five valid. */
function withAttribute(key: string, value: unknown): unknown {
  const base = body() as { attributes: Record<string, unknown> };
  return { ...base, attributes: { ...base.attributes, [key]: value } };
}

describe('parseVisionRead', () => {
  test('accepts a complete, valid read', () => {
    const read = parseVisionRead(body());
    assert.ok(read);
    assert.equal(read.itemName, 'Yogurt tub');
    assert.equal(read.attributes.material.code, 'pp');
    assert.equal(read.attributes.recyclingSymbol.score, 61);
  });

  test('keeps the scores, because the rule engine needs the numbers', () => {
    const read = parseVisionRead(body());
    assert.equal(read?.attributes.contamination.score, 55);
  });

  describe('the body itself', () => {
    for (const [name, value] of [
      ['undefined', undefined],
      ['null', null],
      ['a string', 'ok'],
      ['an array', []],
      ['an empty object', {}],
    ] as const) {
      test('rejects ' + name, () => assert.equal(parseVisionRead(value), undefined));
    }

    test('rejects a body with no attributes object', () => {
      assert.equal(parseVisionRead({ itemName: 'Tub' }), undefined);
    });
  });

  describe('itemName', () => {
    test('rejects an empty one', () => {
      assert.equal(parseVisionRead(body({ itemName: '' })), undefined);
    });

    test('rejects a non string', () => {
      assert.equal(parseVisionRead(body({ itemName: 7 })), undefined);
    });

    /*
     * The proxy truncates to 60 before it answers, so a longer one is drift,
     * not a long name. Failing beats silently re-truncating here.
     */
    test('rejects one past the 60 character wire guarantee', () => {
      assert.equal(parseVisionRead(body({ itemName: 'x'.repeat(61) })), undefined);
    });

    test('accepts one exactly at 60', () => {
      assert.ok(parseVisionRead(body({ itemName: 'x'.repeat(60) })));
    });
  });

  describe('note', () => {
    test('is optional', () => {
      const read = parseVisionRead(body());
      assert.equal(read?.note, undefined);
    });

    test('is kept when present', () => {
      const read = parseVisionRead(body({ note: 'The symbol was faded.' }));
      assert.equal(read?.note, 'The symbol was faded.');
    });

    test('rejects one past 160 characters', () => {
      assert.equal(parseVisionRead(body({ note: 'x'.repeat(161) })), undefined);
    });

    test('rejects an empty one, which the proxy would have omitted', () => {
      assert.equal(parseVisionRead(body({ note: '' })), undefined);
    });
  });

  describe('codes', () => {
    test('rejects a code outside the attribute vocabulary', () => {
      assert.equal(parseVisionRead(withAttribute('material', attribute('tin'))), undefined);
    });

    test('rejects a code valid for a different attribute', () => {
      assert.equal(parseVisionRead(withAttribute('form', attribute('pet'))), undefined);
    });

    /*
     * Spec 0003: photoQuality describes the photo rather than the packaging,
     * so it is always assessable and has no `unknown` to return.
     */
    test('rejects unknown on photoQuality, which has no unknown', () => {
      assert.equal(parseVisionRead(withAttribute('photoQuality', attribute('unknown'))), undefined);
    });

    test('accepts unknown on an attribute that declares it', () => {
      assert.ok(parseVisionRead(withAttribute('material', attribute('unknown'))));
    });
  });

  describe('every attribute is required', () => {
    for (const key of [
      'material',
      'form',
      'recyclingSymbol',
      'construction',
      'contamination',
      'photoQuality',
    ]) {
      test('rejects a read missing ' + key, () => {
        assert.equal(parseVisionRead(withAttribute(key, undefined)), undefined);
      });
    }
  });

  describe('confidence', () => {
    test('rejects a band outside the three', () => {
      assert.equal(
        parseVisionRead(withAttribute('material', attribute('pp', { confidence: 'certain' }))),
        undefined,
      );
    });

    test('rejects a missing band', () => {
      assert.equal(
        parseVisionRead(withAttribute('material', { code: 'pp', display: 'PP', score: 90 })),
        undefined,
      );
    });
  });

  describe('score', () => {
    for (const [name, score] of [
      ['below 0', -1],
      ['above 100', 101],
      ['not an integer', 90.5],
      ['a string', '90'],
      ['NaN', Number.NaN],
    ] as const) {
      test('rejects ' + name, () => {
        assert.equal(
          parseVisionRead(withAttribute('material', attribute('pp', { score }))),
          undefined,
        );
      });
    }

    for (const score of [0, 100]) {
      test('accepts the boundary ' + score, () => {
        assert.ok(parseVisionRead(withAttribute('material', attribute('pp', { score }))));
      });
    }
  });

  describe('display', () => {
    test('rejects an empty line', () => {
      assert.equal(
        parseVisionRead(withAttribute('material', attribute('pp', { display: '' }))),
        undefined,
      );
    });

    test('rejects one past the 60 character wire guarantee', () => {
      assert.equal(
        parseVisionRead(withAttribute('material', attribute('pp', { display: 'x'.repeat(61) }))),
        undefined,
      );
    });
  });

  /*
   * A proxy that adds a field should not break an older build. Tolerating the
   * unknown field while still checking every declared one is the balance spec
   * 0003 asks for.
   */
  test('ignores fields it does not know about', () => {
    const read = parseVisionRead(withAttribute('material', attribute('pp', { hue: 'blue' })));
    assert.equal(read?.attributes.material.code, 'pp');
  });
});
