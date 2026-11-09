import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import appConfig from '../app.config.ts';
import { iosAppTransportSecurity } from '../src/iosReleaseConfig.ts';

const require = createRequire(import.meta.url);
const plist = require('@expo/plist').default;
const { getIosModFileProviders } = require('@expo/config-plugins/build/plugins/withIosBaseMods');
const provider = getIosModFileProviders().infoPlist;
const staticConfig = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

function templateFile(name) {
  const result = spawnSync('tar', ['-xOf', require.resolve('expo/template.tgz'), `package/ios/${name}`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const releaseValues = {
  AM_IOS_BUNDLE_IDENTIFIER: 'com.example.fixture',
  AM_IOS_BUILD_NUMBER: '2',
  EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://www.aminvestmentswv.com/fixture-policy/',
};
const contexts = [
  { name: 'local development', env: {}, localNetworking: true },
  { name: 'simulator', env: { EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'ios-simulator' }, localNetworking: true },
  { name: 'production device', env: { ...releaseValues, EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'ios-production' }, localNetworking: false },
  { name: 'local production config', env: { ...releaseValues, EAS_BUILD_PROFILE: 'ios-production' }, localNetworking: false },
  { name: 'other device profile', env: { ...releaseValues, EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'preview' }, localNetworking: false },
  { name: 'device without profile', env: { ...releaseValues, EAS_BUILD_PLATFORM: 'ios' }, localNetworking: false },
];

function config(introspect, env = {}, input = staticConfig) {
  const keys = ['EAS_BUILD_PLATFORM', 'EAS_BUILD_PROFILE', 'AM_IOS_BUNDLE_IDENTIFIER',
    'AM_IOS_BUILD_NUMBER', 'AM_ANDROID_PACKAGE', 'AM_ANDROID_VERSION_CODE', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    return { ...appConfig({ config: structuredClone(input) }), modRequest: { introspect } };
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function assertTransportPolicy(info, localNetworking = true) {
  const ats = info.NSAppTransportSecurity;
  assert.equal(ats.NSAllowsArbitraryLoads, false, 'Public HTTP must not be globally enabled');
  assert.equal(ats.NSAllowsLocalNetworking, localNetworking, 'Local-network allowance must match the build context');
  assert.notEqual(ats.NSAllowsArbitraryLoadsInWebContent, true);
  assert.notEqual(ats.NSAllowsArbitraryLoadsForMedia, true);
  assert.deepEqual(ats.NSExceptionDomains ?? {}, {}, 'No public-domain HTTP exceptions');
}

test('actual Expo iOS template enforces ATS for Debug and Release', () => {
  assertTransportPolicy(plist.parse(templateFile('HelloWorld/Info.plist')));
  const project = templateFile('HelloWorld.xcodeproj/project.pbxproj');
  // Both app build configurations point at this real plist, not the generic
  // permissive fallback used by source-only Expo introspection.
  const configs = [...project.matchAll(/buildSettings = \{([\s\S]*?)\};\s*name = (Debug|Release);/g)]
    .filter((match) => match[1].includes('INFOPLIST_FILE = HelloWorld/Info.plist;'));
  assert.deepEqual(configs.map((match) => match[2]).sort(), ['Debug', 'Release']);
});

test('app config replaces inherited ATS exceptions while preserving unrelated plist settings', () => {
  const input = structuredClone(staticConfig);
  input.ios.infoPlist = {
    CFBundleDisplayName: 'Test display name',
    NSAppTransportSecurity: {
      NSAllowsArbitraryLoads: true,
      NSAllowsArbitraryLoadsInWebContent: true,
      NSAllowsArbitraryLoadsForMedia: true,
      NSExceptionDomains: { 'http.example': { NSExceptionAllowsInsecureHTTPLoads: true } },
    },
  };
  for (const { env, localNetworking } of contexts) {
    assertTransportPolicy({ NSAppTransportSecurity: iosAppTransportSecurity(env) }, localNetworking);
    const result = config(false, env, input);
    assertTransportPolicy(result.ios.infoPlist, localNetworking);
    assert.equal(result.ios.infoPlist.CFBundleDisplayName, 'Test display name');
  }
  assert.equal(input.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, true, 'Do not mutate the input config');
});

test('real Expo plist provider applies the explicit policy to template and introspection fallback', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'am-ios-ats-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'Info.plist');
  writeFileSync(file, templateFile('HelloWorld/Info.plist'));
  for (const { env, localNetworking } of contexts) {
    for (const introspect of [false, true]) {
      assertTransportPolicy(await provider.read(file, config(introspect, env)), localNetworking);
    }
    // The source-only fallback is deliberately not the native template. App
    // config must override its permissive ATS defaults as well.
    assertTransportPolicy(await provider.read(join(root, 'missing.plist'), config(true, env)), localNetworking);
  }
});

test('real prebuild refuses a missing plist rather than using introspection fallback', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'am-ios-ats-missing-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await assert.rejects(provider.read(join(root, 'missing.plist'), config(false)), { code: 'ENOENT' });
});
