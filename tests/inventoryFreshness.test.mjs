import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryIsCurrent } from '../src/inventoryFreshness.ts';
const check = (snapshot, now) => inventoryIsCurrent(snapshot, Date.parse(now));
test('winter overnight pause accepts evening inventory only through morning grace', () => {
  assert.equal(check('2026-11-08T02:17:00Z', '2026-11-08T12:16:59Z'), true);
  assert.equal(check('2026-11-08T01:17:00Z', '2026-11-08T13:16:59Z'), true);
  assert.equal(check('2026-11-08T01:16:59Z', '2026-11-08T12:00:00Z'), false);
  assert.equal(check('2026-11-08T02:17:00Z', '2026-11-08T13:17:00Z'), false);
});
test('summer and both DST transitions follow New York morning', () => {
  for (const [evening, deadline] of [
    ['2026-07-05T01:17:00Z', '2026-07-05T12:17:00Z'],
    ['2027-03-14T02:17:00Z', '2027-03-14T12:17:00Z'],
    ['2027-11-07T01:17:00Z', '2027-11-07T13:17:00Z'],
  ]) {
    assert.equal(inventoryIsCurrent(evening, Date.parse(deadline) - 1), true);
    assert.equal(check(evening, deadline), false);
  }
});
test('daytime and future bounds remain strict; yesterday evening cannot survive another night', () => {
  assert.equal(check('2026-11-08T14:00:00Z', '2026-11-08T18:00:00Z'), true);
  assert.equal(check('2026-11-08T13:59:59Z', '2026-11-08T18:00:00Z'), false);
  assert.equal(check('2026-11-08T18:06:00Z', '2026-11-08T18:00:00Z'), false);
  assert.equal(check('2026-11-07T02:17:00Z', '2026-11-08T12:00:00Z'), false);
  assert.equal(check('invalid', '2026-11-08T18:00:00Z'), false);
});
