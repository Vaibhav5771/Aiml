/**
 * The prompt's own tests.
 *
 * These exist for one acceptance criterion: the model is never told where the
 * person is, and is never asked for a judgement. That is the product's whole
 * claim, and it is the kind of thing a well meaning edit quietly breaks, so it
 * is worth a test rather than a comment.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROMPT_VERSION, SYSTEM_INSTRUCTION, USER_PROMPT } from './prompt';
import { ATTRIBUTE_KEYS, CODES } from './schema';

const PROMPT = `${SYSTEM_INSTRUCTION}\n${USER_PROMPT}`.toLowerCase();

describe('the prompt names no region', () => {
  // The region this build ships, plus the shapes a region usually leaks in as.
  const REGIONS = ['pune', 'india', 'maharashtra', 'municipal', 'kerbside', 'curbside'];

  for (const word of REGIONS) {
    it(`does not mention "${word}"`, () => {
      assert.equal(PROMPT.includes(word), false);
    });
  }
});

describe('the prompt asks for no verdict', () => {
  /*
   * Checked as instructions present rather than words absent. The words
   * themselves ("recyclable", "bin", "advice") belong in the prompt, because
   * the prompt is where they get forbidden. Banning the substring would ban
   * the prohibition along with it.
   */
  const FORBIDS = [
    'do not say whether anything is recyclable',
    'do not name a bin',
    'do not give advice',
    'describe, never advise',
  ];

  for (const instruction of FORBIDS) {
    it(`tells the model "${instruction}"`, () => {
      assert.ok(PROMPT.includes(instruction));
    });
  }

  it('says out loud that it wants observations only', () => {
    assert.ok(PROMPT.includes('observations only'));
  });

  it('explains why it withholds the region, so a later edit knows the cost', () => {
    assert.ok(PROMPT.includes('which you do not know and must not assume'));
  });
});

describe('the prompt matches the vocabulary', () => {
  it('writes out every code of every attribute, so the model cannot invent one', () => {
    for (const key of ATTRIBUTE_KEYS) {
      for (const code of CODES[key]) {
        assert.ok(PROMPT.includes(code), `${key} is missing the code ${code}`);
      }
    }
  });

  it('asks for packagingFound first', () => {
    assert.ok(PROMPT.includes('answer packagingfound first'));
  });

  it('keeps absent and unknown apart on the symbol', () => {
    assert.ok(PROMPT.includes('absent means you looked'));
  });
});

describe('PROMPT_VERSION', () => {
  it('is a non empty string, because every log line carries it', () => {
    assert.equal(typeof PROMPT_VERSION, 'string');
    assert.ok(PROMPT_VERSION.length > 0);
  });
});
