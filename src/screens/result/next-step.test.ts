/**
 * The two pure pieces behind the check manually treatment.
 *
 * `next-step.ts` reaches `expo-router` at module scope, because `NEXT_STEP`
 * holds a navigation callback. Importing it under `node --test` would pull in
 * `react-native`, which is Flow typed and esbuild cannot transform, so the
 * router is stubbed first and the module is imported dynamically after. That
 * is the whole reason this file needs `--experimental-test-module-mocks`.
 */

import assert from 'node:assert/strict';
import { afterEach, before, describe, it, mock } from 'node:test';

import { ATTRIBUTE_ORDER, type AttributeKey } from '@/vision/types';

/** Every `router.navigate` the module under test made, newest last. */
const navigated: string[] = [];

type NextStepModule = typeof import('./next-step');
let NEXT_STEP: NextStepModule['NEXT_STEP'];
let blockedBy: NextStepModule['blockedBy'];

before(async () => {
  mock.module('expo-router', {
    namedExports: {
      router: {
        navigate: (href: string) => {
          navigated.push(href);
        },
      },
    },
  });

  const loaded = await import('@/screens/result/next-step');
  NEXT_STEP = loaded.NEXT_STEP;
  blockedBy = loaded.blockedBy;
});

afterEach(() => {
  navigated.length = 0;
});

describe('blockedBy', () => {
  // covers: AC-8. The sentence names the read the engine actually stopped on,
  // so a refusal is useful rather than a dead end.
  it('names the single read that blocked the answer', () => {
    assert.equal(blockedBy(['material']), 'It came down to the material read.');
  });

  it('uses the reader facing label, not the attribute key', () => {
    // `contamination` is the machine's word and `Cleanliness` is the reader's.
    // Printing the key here would leak the vocabulary onto the screen.
    assert.equal(blockedBy(['contamination']), 'It came down to the cleanliness read.');
    assert.equal(blockedBy(['recyclingSymbol']), 'It came down to the recycling symbol read.');
    assert.equal(blockedBy(['photoQuality']), 'It came down to the photo quality read.');
  });

  it('joins two reads with "and", and says reads rather than read', () => {
    assert.equal(
      blockedBy(['material', 'contamination']),
      'It came down to the material and cleanliness reads.',
    );
  });

  it('comma separates three or more and keeps "and" before the last', () => {
    assert.equal(
      blockedBy(['material', 'form', 'contamination']),
      'It came down to the material, form and cleanliness reads.',
    );
  });

  // covers: AC-8. Empty is the learned gate, the no match rule, and a scan
  // saved before `decided_on` existed. None of them rested on one read, so the
  // screen must say nothing rather than pick a read to blame.
  it('returns undefined when the record named no attribute', () => {
    assert.equal(blockedBy([]), undefined);
  });

  it('has a label for every attribute in the vocabulary, so no key can leak', () => {
    for (const key of ATTRIBUTE_ORDER) {
      const sentence = blockedBy([key]);
      assert.ok(sentence, `${key} produced no sentence`);
      assert.ok(sentence.startsWith('It came down to the '), `${key} broke the shape`);
      assert.ok(sentence.endsWith(' read.'), `${key} broke the shape`);
      assert.ok(!sentence.includes('undefined'), `${key} has no entry in ATTRIBUTE_LABEL`);
    }
  });

  it('does not mutate the list it is given', () => {
    const decidedOn: AttributeKey[] = ['material', 'form'];
    blockedBy(decidedOn);
    assert.deepEqual(decidedOn, ['material', 'form']);
  });
});

describe('NEXT_STEP', () => {
  // covers: AC-9. A key here is a promise the app itself can perform the step.
  it('offers a second action for the one refusal the app can act on', () => {
    const step = NEXT_STEP['gate-photo-unreadable'];
    assert.ok(step, 'the photo gate lost its next step');
    assert.equal(step.label, 'Take another photo');
    assert.equal(step.icon, 'camera');
  });

  it('sends you to the camera when that action is taken', () => {
    NEXT_STEP['gate-photo-unreadable'].go();
    assert.deepEqual(navigated, ['/']);
  });

  // covers: AC-9. Where the next step is a real world action, only the primary
  // button shows. A key for one of these would be a button that cannot work.
  it('offers nothing for refusals only the person holding the item can resolve', () => {
    for (const id of [
      'gate-material-unreadable',
      'gate-multi-material',
      'gate-heavy-residue',
      'gate-learned-unreliable',
      'no-match',
    ]) {
      assert.equal(NEXT_STEP[id], undefined, `${id} promised an action the app cannot perform`);
    }
  });

  it('is keyed by record id alone, so an unknown rule simply has no second button', () => {
    assert.equal(NEXT_STEP['rule-pp'], undefined);
    assert.equal(NEXT_STEP['a-rule-that-does-not-exist'], undefined);
  });
});
