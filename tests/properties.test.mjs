import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  propertiesForStatus,
  canInquireAboutPurchase,
  parseSnapshot,
  searchProperties,
} from '../src/properties.ts';

const fixtures = [
  { id: 'available-sale', listingType: 'sale', status: 'available' },
  { id: 'contract-sale', listingType: 'sale', status: 'under-contract' },
  { id: 'sold-sale', listingType: 'sale', status: 'sold' },
  { id: 'rental', listingType: 'rental', status: 'available' },
  { id: 'unknown-status', listingType: 'sale', status: 'unknown' },
];

for (const [status, expected] of [
  ['available', 'available-sale'],
  ['under-contract', 'contract-sale'],
  ['sold', 'sold-sale'],
]) {
  test(`${status} contains only sale properties with that exact status`, () => {
    assert.deepEqual(propertiesForStatus(fixtures, status).map((p) => p.id), [expected]);
  });
}

test('only available sale properties allow a purchase inquiry', () => {
  assert.deepEqual(fixtures.map(canInquireAboutPurchase), [true, false, false, false, false]);
});

test('filtering preserves the source collection and order', () => {
  const source = Object.freeze([...fixtures, { ...fixtures[0], id: 'second-sale' }]);
  assert.deepEqual(propertiesForStatus(source, 'available').map((p) => p.id), [
    'available-sale', 'second-sale',
  ]);
  assert.equal(source.length, 6);
});

const source = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url), 'utf8'));

test('the complete saved inventory has unique valid sale records and source provenance', () => {
  const snapshot = parseSnapshot(source);
  assert.equal(new Set(snapshot.properties.map((p) => p.id)).size, snapshot.properties.length);
  assert.equal(snapshot.sourcePropertyCount, snapshot.properties.length + snapshot.excludedNonSaleCount);
  assert.ok(snapshot.sourcePages.length > 1, 'The importer covered pagination');
  for (const property of snapshot.properties) {
    const expected = { 'for sale': 'available', sold: 'sold', pending: 'under-contract', 'under contract': 'under-contract' }[property.sourceStatus];
    assert.equal(property.statusOverride?.fromStatus ?? property.status, expected, property.id);
    if (property.statusOverride) assert.equal(property.status, property.statusOverride.status);
  }
});

test('a valid owner correction permits an available purchase inquiry', () => {
  const copy = structuredClone(source);
  const property = copy.properties[0];
  property.sourceStatus = 'pending';
  property.status = 'available';
  property.statusOverride = { fromStatus: 'under-contract', status: 'available', confirmedOn: '2026-10-18', reason: 'Owner confirmed' };
  assert.equal(canInquireAboutPurchase(parseSnapshot(copy).properties[0]), true);
});

test('source status mismatches require a valid dated owner correction', () => {
  for (const change of [
    (p) => { delete p.statusOverride; },
    (p) => { p.sourceStatus = 'sold'; },
    (p) => { p.statusOverride.reason = ''; },
    (p) => { p.statusOverride.confirmedOn = 'unknown'; },
    (p) => { p.statusOverride.status = 'sold'; },
  ]) {
    const copy = structuredClone(source);
    const p = copy.properties.find((p) => p.id === '4900-4904-jonquil-drive-charleston-wv');
    p.sourceStatus = 'pending';
    p.status = 'available';
    p.statusOverride = { fromStatus: 'under-contract', status: 'available', confirmedOn: '2026-10-18', reason: 'Owner confirmed' };
    change(p);
    assert.throws(() => parseSnapshot(copy));
  }
});

test('unknown statuses, rentals, duplicate IDs, and external source URLs fail validation', () => {
  for (const change of [
    (s) => { s.properties[0].status = 'unknown'; },
    (s) => { s.properties[0].listingType = 'rental'; },
    (s) => { s.properties[1].id = s.properties[0].id; },
    (s) => { s.properties[0].detailsUrl = 'https://example.com/property/unknown'; },
    (s) => { s.properties[0].imageUrl = 'javascript:alert(1)'; },
    (s) => { s.properties[0].price = Number.NaN; },
    (s) => { s.sourcePropertyCount += 1; },
  ]) {
    const copy = structuredClone(source); change(copy);
    assert.throws(() => parseSnapshot(copy));
  }
});

test('search matches address and city without case sensitivity and requires every term', () => {
  const properties = [
    { address: '306 Millstone Drive', city: 'Beckley', state: 'WV' },
    { address: '12 Example Street', city: 'Charleston', state: 'WV', postalCode: '25301' },
  ];
  assert.deepEqual(searchProperties(properties, '  MILLSTONE  beckley '), [properties[0]]);
  assert.deepEqual(searchProperties(properties, '25301'), [properties[1]]);
  assert.deepEqual(searchProperties(properties, 'millstone charleston'), []);
  assert.deepEqual(searchProperties(properties, '   '), properties);
});
