import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { verifyPublishedInventory } from '../scripts/verify_published_inventory.mjs';

const source = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url)));
const now = Date.parse('2026-11-07T01:00:00Z');
const expected = () => ({ ...structuredClone(source), checkedAt: '2026-11-07T00:30:00Z' });
const reply = (data, status = 200, contentType = 'application/json') => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': contentType } });
const verify = (overrides = {}) => verifyPublishedInventory(expected(), { now: () => now, attempts: 2, delayMs: 0, sleep: async () => {}, reportFailure: () => {}, fetcher: async () => reply(expected()), ...overrides });

test('public inventory must match the complete validated artifact', async () => {
  const report = await verify();
  assert.deepEqual(report, { passed: true, checkedAt: expected().checkedAt, propertyCount: source.properties.length, attempts: 1 });
});

test('temporary missing feed can recover only with a complete matching response', async () => {
  let requests = 0;
  const urls = [];
  const report = await verify({ now: () => now + requests, fetcher: async (url) => { urls.push(url); return ++requests === 1 ? reply({}, 404) : reply(expected()); } });
  assert.equal(report.attempts, 2);
  assert.notEqual(urls[0], urls[1]);
});

test('valid but different, newer, malformed and wrong-MIME inventory cannot pass', async () => {
  const changed = expected(); changed.properties[0].description = 'Different but schema-valid content';
  for (const [body, mime] of [[changed, 'application/json'], [{ ...expected(), checkedAt: '2026-11-07T00:45:00Z' }, 'application/json'], [{}, 'application/json'], [expected(), 'text/html']]) {
    let calls = 0;
    await assert.rejects(verify({ fetcher: async () => { calls++; return reply(body, 200, mime); } }), /failed after 2 attempt/);
    assert.equal(calls, 2);
  }
});

test('permanent 404 and stalled requests fail within fixed attempt limits', async () => {
  let calls = 0;
  await assert.rejects(verify({ fetcher: async () => { calls++; return reply({}, 404); } }), /failed after 2 attempt/);
  assert.equal(calls, 2);
  await assert.rejects(verify({ attempts: 1, timeoutMs: 5, fetcher: async () => new Promise(() => {}) }), /timed out/);
});

test('invalid local snapshot or retry settings fail before network work', async () => {
  await assert.rejects(verifyPublishedInventory({}, { fetcher: async () => assert.fail('No request expected') }), /Invalid property snapshot/);
  for (const options of [{ attempts: 0 }, { attempts: 7 }, { timeoutMs: 0 }, { timeoutMs: 12_001 }, { delayMs: -1 }, { delayMs: 5_001 }]) {
    await assert.rejects(verify({ ...options, fetcher: async () => assert.fail('No request expected') }), /retry limits/);
  }
});

test('feed export and post-publication verification keep the established production safeguards in order', () => {
  const workflow = readFileSync(new URL('../.github/workflows/hourly-refresh.yml', import.meta.url), 'utf8');
  const commands = ['node scripts/export_inventory.mjs web-build', 'python scripts/check_health.py', 'python scripts/verify_refresh.py', 'actions/upload-pages-artifact@', 'actions/deploy-pages@', 'python scripts/verify_published_startup.py', 'node scripts/verify_published_inventory.mjs web-build', 'python scripts/send_property_notifications.py'];
  const positions = commands.map((command) => workflow.indexOf(command));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('response bodies and arbitrary network error text never reach verification logs', async () => {
  for (const fetcher of [
    async () => new Response('BODY_CONTENT_MARKER', { headers: { 'Content-Type': 'application/json' } }),
    async () => { throw Error('BODY_CONTENT_MARKER'); },
  ]) {
    const logs = [];
    await assert.rejects(verify({ fetcher, reportFailure: (message) => logs.push(message) }), (error) => {
      assert.ok(!error.message.includes('BODY_CONTENT_MARKER'));
      return true;
    });
    assert.ok(logs.length);
    assert.ok(logs.every((message) => !message.includes('BODY_CONTENT_MARKER')));
  }
});

test('HTTP access denials and nontransient errors stop without retry', async () => {
  for (const status of [400, 401, 403, 410]) {
    let calls = 0;
    await assert.rejects(verify({ fetcher: async () => { calls++; return reply({}, status); } }), /failed after 1 attempt/);
    assert.equal(calls, 1);
  }
});
