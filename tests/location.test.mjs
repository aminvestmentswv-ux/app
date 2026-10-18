import assert from 'node:assert/strict';
import test from 'node:test';
import { propertyLocation } from '../src/location.ts';

const property = { address: '4900 & 4904 Jonquil Drive', city: 'Charleston', state: 'WV', postalCode: '25306' };

test('map and directions use the complete published address, encoded as data', () => {
  const location = propertyLocation(property);
  assert.equal(location.address, '4900 & 4904 Jonquil Drive, Charleston, WV 25306');
  assert.equal(new URL(location.embedUrl).searchParams.get('q'), location.address);
  assert.equal(new URL(location.embedUrl).searchParams.get('output'), 'embed');
  assert.equal(new URL(location.mapsUrl).searchParams.get('query'), location.address);
  assert.equal(new URL(location.mapsUrl).searchParams.get('api'), '1');
});

test('missing or explicitly incomplete locations do not create a guessed map', () => {
  for (const change of [{ locationIncomplete: true }, { city: '' }, { state: '' }, { address: ' ' }]) {
    assert.equal(propertyLocation({ ...property, ...change }), null);
  }
  assert.equal(propertyLocation({ ...property, postalCode: undefined }).address, '4900 & 4904 Jonquil Drive, Charleston, WV');
});
