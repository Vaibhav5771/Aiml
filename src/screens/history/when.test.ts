/**
 * The history list's date column. Pure, so it runs on `node --test` with no
 * device and no clock freezing: `now` is passed in.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { whenLabel } from './when';

/** A fixed afternoon, so "today" has hours either side of it. */
const NOW = new Date('2026-10-16T14:00:00').getTime();
const at = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

describe('whenLabel', () => {
  it('says just now inside the first minute', () => {
    assert.equal(whenLabel(at(0), NOW), 'Just now');
    assert.equal(whenLabel(at(59_000), NOW), 'Just now');
  });

  it('counts minutes up to the hour', () => {
    assert.equal(whenLabel(at(60_000), NOW), '1 min ago');
    assert.equal(whenLabel(at(59 * 60_000), NOW), '59 min ago');
  });

  it('counts hours while it is still the same calendar day', () => {
    assert.equal(whenLabel(at(60 * 60_000), NOW), '1 hour ago');
    assert.equal(whenLabel(at(3 * 60 * 60_000), NOW), '3 hours ago');
  });

  it('crosses to Yesterday on the calendar day, not after 24 hours', () => {
    // 15 hours earlier is 23:00 the previous day: yesterday, not "15 hours".
    assert.equal(whenLabel(at(15 * 60 * 60_000), NOW), 'Yesterday');
  });

  it('counts days inside the week', () => {
    assert.equal(whenLabel(at(3 * 86_400_000), NOW), '3 days ago');
    assert.equal(whenLabel(at(6 * 86_400_000), NOW), '6 days ago');
  });

  it('falls back to a date beyond a week', () => {
    const label = whenLabel(at(30 * 86_400_000), NOW);
    assert.notEqual(label, '');
    assert.ok(!label.includes('ago'), `expected a date, got ${label}`);
  });

  it('never claims a future, and never renders Invalid Date', () => {
    assert.equal(whenLabel(new Date(NOW + 5 * 60_000).toISOString(), NOW), 'Just now');
    assert.equal(whenLabel('not a date', NOW), '');
  });
});
