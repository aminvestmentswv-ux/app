import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fetchPropertySnapshot, createInventoryStore, INVENTORY_FEED_URL } from '../src/inventoryFeed.ts';
import { parseSnapshot } from '../src/properties.ts';
import { publicPropertySnapshot } from '../scripts/export_inventory.mjs';
const source = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url)));
// The hourly workflow updates source.checkedAt before running tests. Freeze the
// test clock and fallback independently so a successful import cannot break CI.
const bundled = { ...source, checkedAt: '2026-11-05T12:00:00Z' };
const now = Date.parse('2026-11-06T12:00:00Z');
const fresh = () => ({ ...structuredClone(bundled), checkedAt: '2026-11-06T11:30:00Z' });
const reply = (data, init) => new Response(typeof data === 'string' ? data : JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }, ...init });
const load = (response, current = bundled) => fetchPropertySnapshot(current, { now, fetcher: async () => response });

test('native feed accepts a fully validated newer snapshot without credentials', async () => {
  const data = fresh();
  const result = await fetchPropertySnapshot(bundled, { now, fetcher: async (url, options) => {
    assert.equal(url, `${INVENTORY_FEED_URL}?check=${now}`);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    return reply(data);
  } });
  assert.deepEqual(result, data);
});

test('HTTP errors, HTML, invalid JSON and unsafe records are rejected', async () => {
  for (const response of [reply({}, { status: 503 }), reply('<html/>', { headers: { 'Content-Type': 'text/html' } }), reply('{'), reply({})]) {
    await assert.rejects(load(response));
  }
  for (const change of [
    (data) => { data.properties[0].description = {}; },
    (data) => { data.properties[0].title = 55; },
    (data) => { data.properties[0].postalCode = []; },
    (data) => { data.properties[0].locationIncomplete = 'yes'; },
    (data) => { data.properties[0].images = [null]; },
    (data) => { data.properties[0].listingType = 'rental'; },
    (data) => { data.properties[0].detailsUrl = 'https://untrusted.example/'; },
    (data) => { data.sourcePages = []; },
  ]) {
    const data = fresh(); change(data);
    assert.throws(() => parseSnapshot(data));
    await assert.rejects(load(reply(data)));
  }
});

test('stale, future and older snapshots cannot replace newer inventory', async () => {
  for (const checkedAt of ['2026-11-05T12:00:00Z', '2026-11-06T12:06:00Z']) {
    await assert.rejects(load(reply({ ...fresh(), checkedAt })));
  }
  await assert.rejects(load(reply({ ...fresh(), checkedAt: '2026-11-06T11:00:00Z' }), fresh()));
});

test('oversized feeds and unexpected redirected origins fail closed', async () => {
  await assert.rejects(load(reply('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '5000001' } })));
  const response = reply(fresh());
  Object.defineProperty(response, 'url', { value: 'https://untrusted.example/properties.json' });
  await assert.rejects(load(response));
});

test('request timeout is bounded even if the network ignores abort', async () => {
  let signal;
  await assert.rejects(fetchPropertySnapshot(bundled, { now, timeoutMs: 5, fetcher: async (_, options) => { signal = options.signal; return new Promise(() => {}); } }), /timed out/);
  assert.equal(signal.aborted, true);
});

test('repeated refreshes share one request; failure retains last valid snapshot and permits retry', async () => {
  let calls = 0;
  let shouldFail = false;
  const data = fresh();
  const store = createInventoryStore(bundled, async () => { calls++; if (shouldFail) throw Error('offline'); return data; });
  const changes = [];
  const unsubscribe = store.subscribe(() => changes.push(store.getSnapshot()));
  const first = store.refresh();
  assert.equal(store.refresh(), first);
  await first;
  assert.equal(calls, 1);
  assert.equal(store.getSnapshot().snapshot, data);
  assert.equal(store.getSnapshot().refreshing, false);
  shouldFail = true;
  await store.refresh();
  assert.equal(store.getSnapshot().snapshot, data);
  assert.match(store.getSnapshot().feedback, /saved inventory/);
  shouldFail = false;
  await store.refresh();
  assert.equal(calls, 3);
  assert.match(store.getSnapshot().feedback, /latest published/);
  unsubscribe();
  assert.equal(changes.length, 6);
});

test('offline startup retains bundled snapshot without a false current claim', async () => {
  const store = createInventoryStore(bundled, async () => { throw Error('offline'); });
  await store.refresh();
  assert.equal(store.getSnapshot().snapshot, bundled);
  assert.match(store.getSnapshot().feedback, /availability may have changed/);
});

test('feed export writes exact validated inventory beside a web build', () => {
  const folder = mkdtempSync(join(tmpdir(), 'am-feed-test-'));
  try {
    assert.notEqual(spawnSync(process.execPath, ['scripts/export_inventory.mjs', folder]).status, 0);
    writeFileSync(join(folder, 'index.html'), '<html/>');
    const result = spawnSync(process.execPath, ['scripts/export_inventory.mjs', folder], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(folder, 'properties.json'))), publicPropertySnapshot(source));
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('timeout also bounds a stalled response body and keeps the saved inventory', async () => {
  let aborted;
  await assert.rejects(fetchPropertySnapshot(bundled, { now, timeoutMs: 5, fetcher: async (_, options) => {
    aborted = options.signal;
    return { ok: true, headers: new Headers({ 'Content-Type': 'application/json' }), url: INVENTORY_FEED_URL,
      text: async () => new Promise(() => {}) };
  } }), /timed out/);
  assert.equal(aborted.aborted, true);
});

test('oversized chunked body is rejected even with no Content-Length header', async () => {
  await assert.rejects(load(reply(' '.repeat(5_000_001))), /too large/);
});

test('a request that resolves after timeout cannot replace saved state', async () => {
  let finish;
  const store = createInventoryStore(bundled, (current) => fetchPropertySnapshot(current, {
    now, timeoutMs: 5, fetcher: async () => new Promise((resolve) => { finish = resolve; }),
  }));
  await store.refresh();
  assert.equal(store.getSnapshot().snapshot, bundled);
  finish(reply(fresh()));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(store.getSnapshot().snapshot, bundled);
  assert.equal(store.getSnapshot().refreshing, false);
});

test('updated statuses and removed properties replace the inventory atomically', async () => {
  const next = fresh();
  const changed = next.properties.find((property) => property.status === 'available');
  const changedId = changed.id;
  changed.status = 'sold'; changed.sourceStatus = 'sold'; delete changed.statusOverride;
  const removedId = next.properties.at(-1).id;
  next.properties = next.properties.filter((property) => property.id !== removedId);
  next.sourcePropertyCount -= 1;
  const store = createInventoryStore(bundled, (current) => fetchPropertySnapshot(current, { now, fetcher: async () => reply(next) }));
  await store.refresh();
  assert.equal(store.getSnapshot().snapshot.properties.find((property) => property.id === changedId).status, 'sold');
  assert.equal(store.getSnapshot().snapshot.properties.some((property) => property.id === removedId), false);
  assert.equal(store.getSnapshot().snapshot.checkedAt, next.checkedAt);
});
