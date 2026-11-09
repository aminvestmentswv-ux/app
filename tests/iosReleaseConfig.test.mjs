import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { iosReleaseSettings } from '../src/iosReleaseConfig.ts';
import { verifyIosBuildReadiness } from '../scripts/verify_native_release.mjs';
const env = { EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'ios-production', AM_IOS_BUNDLE_IDENTIFIER: 'com.example.fixture', AM_IOS_BUILD_NUMBER: '2', EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://www.aminvestmentswv.com/fixture-policy/' };
const source = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url)));
const now = Date.parse('2026-11-07T01:00:00Z');
const fresh = () => ({ ...structuredClone(source), checkedAt: '2026-11-07T00:30:00Z' });
const response = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const check = (overrides = {}) => verifyIosBuildReadiness({ env, bundled: fresh(), now, fetcher: async () => response(fresh()), ...overrides });
test('local web and named simulator config need no production identity', () => {
  for (const e of [{}, { EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'ios-simulator' }]) assert.deepEqual(iosReleaseSettings(e), { bundleIdentifier: undefined, buildNumber: undefined });
});
test('all iOS device profiles require identity, version and privacy', () => {
  for (const profile of ['ios-production', 'preview', undefined]) for (const key of ['AM_IOS_BUNDLE_IDENTIFIER', 'AM_IOS_BUILD_NUMBER', 'EXPO_PUBLIC_PRIVACY_POLICY_URL']) {
    const copy = { ...env, EAS_BUILD_PROFILE: profile }; delete copy[key]; assert.throws(() => iosReleaseSettings(copy), /iOS device builds require/);
  }
  assert.deepEqual(iosReleaseSettings(env), { bundleIdentifier: 'com.example.fixture', buildNumber: '2' });
});
test('named iOS production profile fails closed before EAS supplies the platform', () => {
  for (const key of ['AM_IOS_BUNDLE_IDENTIFIER', 'AM_IOS_BUILD_NUMBER', 'EXPO_PUBLIC_PRIVACY_POLICY_URL']) {
    const copy = { ...env }; delete copy.EAS_BUILD_PLATFORM; delete copy[key];
    assert.throws(() => iosReleaseSettings(copy), /iOS device builds require/);
  }
});
test('Expo introspection placeholder is never an iOS release identity', async () => {
  for (const bundleIdentifier of ['com.placeholder.appid', 'COM.PLACEHOLDER.APPID']) {
    assert.throws(() => iosReleaseSettings({ AM_IOS_BUNDLE_IDENTIFIER: bundleIdentifier }), /Expo placeholder identifier/);
    await assert.rejects(check({
      env: { ...env, AM_IOS_BUNDLE_IDENTIFIER: bundleIdentifier },
      fetcher: async () => assert.fail('Placeholder identity must fail before fetching'),
    }), /Expo placeholder identifier/);
  }
});
test('case variants of the reserved iOS QA identifier fail before network access', async () => {
  await assert.rejects(check({
    env: { ...env, AM_IOS_BUNDLE_IDENTIFIER: 'Com.Aminvestments.Nativeqatest' },
    fetcher: async () => assert.fail('QA identity must fail before fetching'),
  }), /disposable QA identifier/);
});
test('reject invalid or disposable identities, versions and unsafe policy URLs', () => {
  for (const [key, values] of [
    ['AM_IOS_BUNDLE_IDENTIFIER', ['bad', 'com.example_*', 'com.aminvestments.nativeqatest', 'com.example;bad']],
    ['AM_IOS_BUILD_NUMBER', ['0', '-1', '1.5', '10000', '01', 'abc']],
    ['EXPO_PUBLIC_PRIVACY_POLICY_URL', ['http://www.aminvestmentswv.com/privacy/', 'https://attacker.example/', 'https://user:pass@www.aminvestmentswv.com/']],
  ]) for (const value of values) assert.throws(() => iosReleaseSettings({ ...env, [key]: value }));
});
test('iOS readiness fails before network when identity or fallback is invalid', async () => {
  await assert.rejects(check({ env: {}, fetcher: async () => assert.fail('must not fetch') }), /iOS device builds require/);
  for (const checkedAt of ['2026-10-18T12:00:00Z', '2026-11-07T01:06:00Z']) await assert.rejects(check({ bundled: { ...fresh(), checkedAt }, fetcher: async () => assert.fail('must not fetch') }), /bundled inventory is not current/);
});
test('iOS readiness rejects offline, invalid and regressed feeds', async () => {
  for (const fetcher of [async () => { throw Error('offline'); }, async () => response({}), async () => response({ ...fresh(), checkedAt: '2026-11-07T00:29:00Z' })]) await assert.rejects(check({ fetcher }));
});
test('iOS readiness accepts valid feed and reports confirmed identity without signing', async () => {
  const result = await check();
  assert.equal(result.bundleIdentifier, env.AM_IOS_BUNDLE_IDENTIFIER);
  assert.equal(result.buildNumber, '2');
  assert.equal(result.publishedPropertyCount, source.properties.length);
});
test('production EAS profile is store/device, pinned Node; simulator stays simulator', () => {
  const config = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url)));
  assert.deepEqual(config.build['ios-production'], { distribution: 'store', ios: { simulator: false }, node: '24.22.1' });
  assert.equal(config.build['ios-simulator'].ios.simulator, true);
});
test('EAS hook fails closed for unknown platform and unconfigured iOS device build', () => {
  for (const EAS_BUILD_PLATFORM of ['other', 'ios']) {
    const clean = { ...process.env, EAS_BUILD_PLATFORM, EAS_BUILD_PROFILE: 'ios-production' };
    for (const key of ['AM_IOS_BUNDLE_IDENTIFIER', 'AM_IOS_BUILD_NUMBER', 'EXPO_PUBLIC_PRIVACY_POLICY_URL']) delete clean[key];
    const result = spawnSync(process.execPath, ['scripts/verify_native_release.mjs', '--eas-hook'], { encoding: 'utf8', env: clean });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /unknown EAS build platform|iOS device builds require/);
  }
});
