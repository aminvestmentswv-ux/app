import test from 'node:test';
import assert from 'node:assert/strict';
import { PROPERTY_WATCH_DELIVERY_ENABLED, priceDrops, priceDropTargets, stopWatching } from '../src/propertyWatch.ts';
const p = (price, status = 'available', id = 'house') => ({ id, status, price });
const b = (properties, checkedAt = 1000) => ({ properties, checkedAt });
const drop = { propertyId: 'house', oldPrice: 100000, newPrice: 90000, observedAt: 2000 };
test('delivery remains disabled and fresh setup cannot replay old prices', () => {
  assert.equal(PROPERTY_WATCH_DELIVERY_ENABLED, false);
  assert.deepEqual(priceDrops(null, b([p(90000)], 2000)), []);
  assert.deepEqual(priceDrops(b([p(100000)]), b([p(90000)], 12e6)), []);
  assert.deepEqual(priceDrops(b([p(100000)]), b([p(90000)], 1000)), []);
});
test('only a real numeric drop on an eligible existing property qualifies', () => {
  assert.deepEqual(priceDrops(b([p(100000)]), b([p(90000)], 2000)), [drop]);
  for (const item of [p(100000), p(110000), p(undefined), p(0), p(NaN), p(Infinity), p(90000, 'sold'), p(90000, 'under-contract'), p(90000, 'available', 'new')]) {
    assert.deepEqual(priceDrops(b([p(100000)]), b([item], 2000)), []);
  }
  assert.deepEqual(priceDrops(b([p(undefined)]), b([p(90000)], 2000)), []);
  assert.throws(() => priceDrops(b([p(100000)]), b([p(90000),p(90000)], 2000)), /Duplicate/);
});
const watches = [
  { propertyId: 'house', subscriptionId: 'device-a', optedIn: true, startedAt: 500 },
  { propertyId: 'house', subscriptionId: 'device-b', optedIn: true, startedAt: 500 },
  { propertyId: 'house', subscriptionId: 'device-c', optedIn: false, startedAt: 500 },
  { propertyId: 'house', subscriptionId: 'device-d', optedIn: true, startedAt: 1500 },
  { propertyId: 'other', subscriptionId: 'device-e', optedIn: true, startedAt: 500 },
];
test('only explicitly opted-in, still-subscribed devices watching before baseline qualify', () => {
  assert.deepEqual(priceDropTargets(drop, [...watches,watches[0]], 1000, new Set(['device-a','device-c','device-d','device-e'])), ['device-a']);
  assert.deepEqual(priceDropTargets(drop, watches, 1000, new Set()), []);
});
test('unwatch only affects this property on this device and prevents later targeting', () => {
  const remaining = stopWatching(watches, 'house', 'device-a');
  assert.equal(remaining.length, 4);
  assert.deepEqual(priceDropTargets(drop, remaining, 1000, new Set(['device-a','device-b'])), ['device-b']);
});
