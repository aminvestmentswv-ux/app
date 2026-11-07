import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareNativeQa } from '../scripts/prepare_native_qa.mjs';

const env = { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', GITHUB_REPOSITORY: 'aminvestmentswv-ux/app', GITHUB_REF: 'refs/heads/test/native-live-feed-2026-11-07', AM_TEST_PACKAGE: 'com.aminvestments.nativeqatest', AM_TEST_IOS_BUNDLE_ID: 'com.aminvestments.nativeqatest' };
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'am-native-qa-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { name: 'original' } }));
  fs.writeFileSync(path.join(root, 'App.tsx'), 'return <SafeAreaProvider><PropertyApp /></SafeAreaProvider>;');
  fs.writeFileSync(path.join(root, 'index.ts'), "import App from './App';");
  return root;
}
test('QA preparation refuses production branches, accounts and non-hosted execution', (t) => {
  const root = fixture(t);
  for (const override of [{ GITHUB_REF: 'refs/heads/main' }, { GITHUB_ACTIONS: 'false' }, { RUNNER_ENVIRONMENT: 'self-hosted' }, { GITHUB_REPOSITORY: 'other/repo' }, { EAS_BUILD_PLATFORM: 'ios' }, { AM_ANDROID_PACKAGE: 'com.aminvestments.real' }, { EXPO_PUBLIC_ONESIGNAL_APP_ID: 'public-id' }]) {
    assert.throws(() => prepareNativeQa(root, { ...env, ...override }, 'android'));
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'app.json'))).expo.name, 'original');
});
for (const platform of ['android', 'ios']) test(`QA preparation isolates ${platform} identity and only adds test imports`, (t) => {
  const root = fixture(t);
  prepareNativeQa(root, env, platform);
  const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'))).expo;
  assert.equal(config.scheme, 'am-native-qa');
  assert.equal(config[platform][platform === 'android' ? 'package' : 'bundleIdentifier'], 'com.aminvestments.nativeqatest');
  assert.match(fs.readFileSync(path.join(root, 'App.tsx'), 'utf8'), /NativeQaStatus/);
  assert.match(fs.readFileSync(path.join(root, 'index.ts'), 'utf8'), /native_qa_adapter/);
  assert.throws(() => prepareNativeQa(root, env, platform), /already instrumented/);
});
