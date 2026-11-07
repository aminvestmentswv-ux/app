import assert from 'node:assert/strict';
import test from 'node:test';
import { androidReleaseSettings } from '../src/androidReleaseConfig.ts';
const env = { EAS_BUILD_PLATFORM: 'android', AM_ANDROID_PACKAGE: 'com.example.fixture', AM_ANDROID_VERSION_CODE: '1', EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://www.aminvestmentswv.com/fixture-policy/' };

test('local browsing needs no guessed store identity', () => {
  assert.deepEqual(androidReleaseSettings({}), { packageName: undefined, versionCode: undefined });
});
test('Android cloud builds require explicit identity, version and policy', () => {
  for (const key of ['AM_ANDROID_PACKAGE', 'AM_ANDROID_VERSION_CODE', 'EXPO_PUBLIC_PRIVACY_POLICY_URL']) {
    const copy = { ...env }; delete copy[key]; assert.throws(() => androidReleaseSettings(copy));
  }
  assert.deepEqual(androidReleaseSettings(env), { packageName: 'com.example.fixture', versionCode: 1 });
});
test('invalid IDs, version codes and policy links fail early', () => {
  for (const [key, values] of [
    ['AM_ANDROID_PACKAGE', ['bad', 'com.Example', 'com.example;bad']],
    ['AM_ANDROID_VERSION_CODE', ['0', '-1', '1.5', '2100000001', 'abc']],
    ['EXPO_PUBLIC_PRIVACY_POLICY_URL', ['http://www.aminvestmentswv.com/privacy/', 'https://attacker.example/privacy/', 'https://user:pass@www.aminvestmentswv.com/privacy/']],
  ]) for (const value of values) assert.throws(() => androidReleaseSettings({ ...env, [key]: value }));
});
