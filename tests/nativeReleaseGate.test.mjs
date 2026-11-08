import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { verifyAndroidBuildReadiness } from '../scripts/verify_native_release.mjs';

const source = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url)));
const now = Date.parse('2026-11-07T01:00:00Z');
const env = { AM_ANDROID_PACKAGE: 'com.example.fixture', AM_ANDROID_VERSION_CODE: '2', EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://www.aminvestmentswv.com/fixture-policy/' };
const fresh = () => ({ ...structuredClone(source), checkedAt: '2026-11-07T00:30:00Z' });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const check = (overrides = {}) => verifyAndroidBuildReadiness({ env, bundled: fresh(), now, fetcher: async () => response(fresh()), ...overrides });

test('Android build readiness requires explicit release values before attempting the network', async () => {
  for (const key of Object.keys(env)) {
    const missing = { ...env }; delete missing[key];
    await assert.rejects(check({ env: missing, fetcher: async () => { assert.fail('Identity must fail first'); } }), /Android builds require/);
  }
});

test('Android builds reject stale/future bundled fallback before attempting the network', async () => {
  for (const checkedAt of ['2026-10-18T12:00:00Z', '2026-11-07T01:06:00Z']) {
    await assert.rejects(check({ bundled: { ...fresh(), checkedAt }, fetcher: async () => { assert.fail('Fallback freshness must fail first'); } }), /bundled inventory is not current/);
  }
});

test('Android build readiness requires a valid reachable public feed at least as new as the fallback', async () => {
  for (const fetcher of [
    async () => response({}, 404),
    async () => { throw Error('offline'); },
    async () => response({ ...fresh(), checkedAt: '2026-11-06T20:00:00Z' }),
    async () => response({ ...fresh(), checkedAt: '2026-11-07T00:29:00Z' }),
    async () => response({}),
  ]) await assert.rejects(check({ fetcher }));
});

test('Android build readiness passes current matching feed and fallback without signing or publication', async () => {
  const result = await check();
  assert.equal(result.packageName, env.AM_ANDROID_PACKAGE);
  assert.equal(result.versionCode, 2);
  assert.equal(result.bundledCheckedAt, fresh().checkedAt);
  assert.equal(result.publishedCheckedAt, fresh().checkedAt);
  assert.equal(result.bundledPropertyCount, source.properties.length);
});

test('EAS hook is attached to the Android build lifecycle without changing iOS simulator checks', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.scripts['eas-build-post-install'], 'node scripts/verify_native_release.mjs --eas-hook');
  const directory = mkdtempSync(join(tmpdir(), 'am-ios-hook-'));
  try {
    // Simulate an otherwise supported image that cannot load .ts modules.
    const loader = join(directory, 'no-typescript.mjs');
    writeFileSync(loader, `export async function resolve(specifier, context, next) {
      if (specifier.endsWith('.ts')) throw Error('iOS skip must not import TypeScript');
      return next(specifier, context);
    }`);
    const result = spawnSync(process.execPath, ['--loader', loader, 'scripts/verify_native_release.mjs', '--eas-hook'], { encoding: 'utf8', env: { ...process.env, EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'ios-simulator' } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /skipped for the named iOS simulator profile/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('Android EAS profiles pin the Node version used to validate direct TypeScript imports', () => {
  const config = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url)));
  for (const profile of ['android-preview', 'android-production']) assert.equal(config.build[profile].node, '24.22.1');
  assert.equal(config.build['ios-simulator'].node, undefined);
});

test('Android release preflight rejects the QA identity before network access', async () => {
  await assert.rejects(check({
    env: { ...env, AM_ANDROID_PACKAGE: 'com.aminvestments.nativeqatest' },
    fetcher: async () => { assert.fail('QA identity must fail before fetching'); },
  }), /disposable QA identifier/);
});

test('Android preflight and feed accept final evening inventory overnight but reject missed morning refresh', async () => {
  const bundled = { ...fresh(), checkedAt: '2026-11-08T02:17:00Z' };
  const fetcher = async () => response(bundled);
  await check({ bundled, fetcher, now: Date.parse('2026-11-08T13:16:59Z') });
  await assert.rejects(check({ bundled, fetcher, now: Date.parse('2026-11-08T13:17:00Z') }), /bundled inventory is not current/);
});
