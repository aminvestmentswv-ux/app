import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { publicPropertySnapshot } from '../scripts/export_inventory.mjs';
import { parseSnapshot } from '../src/properties.ts';

const source = () => JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url)));

test('public export preserves the existing website listing inventory', () => {
  const expected = source();
  for (const property of expected.properties) if (property.statusOverride) property.statusOverride.reason = 'Availability corrected by AM Investments.';
  assert.deepEqual(publicPropertySnapshot(source()), expected);
});

test('unknown fields at every level cannot leak into the public feed', () => {
  const input = source();
  input.internalNotes = 'PRIVATE_TEST_MARKER';
  input.customerRecords = [{ note: 'PRIVATE_TEST_MARKER' }];
  input.properties[0].ownerEmail = 'PRIVATE_TEST_MARKER';
  input.properties[0].internalNotes = 'PRIVATE_TEST_MARKER';
  const photographed = input.properties.find((property) => property.images?.length);
  assert.ok(photographed, 'Fixture must contain a published photograph');
  photographed.images[0].internalNotes = 'PRIVATE_TEST_MARKER';
  const output = publicPropertySnapshot(input);
  assert.ok(!JSON.stringify(output).includes('PRIVATE_TEST_MARKER'));
  assert.deepEqual(output, publicPropertySnapshot(source()));
  assert.equal(input.internalNotes, 'PRIVATE_TEST_MARKER', 'Input remains unchanged');
});

test('correction provenance stays valid without publishing internal reasons or extra fields', () => {
  const input = source();
  const property = input.properties[0];
  property.status = 'available'; property.sourceStatus = 'pending';
  property.statusOverride = { fromStatus: 'under-contract', status: 'available', confirmedOn: '2026-11-06', reason: 'PRIVATE_TEST_MARKER', internalContact: 'PRIVATE_TEST_MARKER' };
  const output = publicPropertySnapshot(input);
  assert.ok(!JSON.stringify(output).includes('PRIVATE_TEST_MARKER'));
  assert.equal(output.properties[0].status, 'available');
  assert.equal(output.properties[0].statusOverride.reason, 'Availability corrected by AM Investments.');
  assert.doesNotThrow(() => parseSnapshot(output));
});
