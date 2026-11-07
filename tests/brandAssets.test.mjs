import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const expected = 'c90c6e35f173645364c0a51877cb0e529a0b57d4f7a4507dc94c0a616fa75364';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('bundled artwork preserves the owner-confirmed circular blue-and-gold logo', () => {
  const encoded = readFileSync(new URL('../assets/am-investments-logo-house.png.base64', import.meta.url), 'utf8');
  assert.equal(hash(Buffer.from(encoded, 'base64')), expected);
  assert.equal(hash(readFileSync(new URL('../assets/am-investments-logo-house.png', import.meta.url))), expected);
});
