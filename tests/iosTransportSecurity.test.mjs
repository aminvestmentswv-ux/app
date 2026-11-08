import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import appConfig from '../app.config.ts';

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

function config(introspect) {
  return { ...appConfig({ config: structuredClone(staticConfig) }), modRequest: { introspect } };
}

function assertTransportPolicy(info) {
  const ats = info.NSAppTransportSecurity;
  assert.equal(ats.NSAllowsArbitraryLoads, false, 'Public HTTP must not be globally enabled');
  assert.equal(ats.NSAllowsLocalNetworking, true, 'Preserve the template local-development exception');
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

test('current app config and real Expo plist provider preserve template ATS', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'am-ios-ats-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'Info.plist');
  writeFileSync(file, templateFile('HelloWorld/Info.plist'));
  for (const introspect of [false, true]) {
    assertTransportPolicy(await provider.read(file, config(introspect)));
  }
});

test('real prebuild refuses a missing plist rather than using introspection fallback', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'am-ios-ats-missing-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  await assert.rejects(provider.read(join(root, 'missing.plist'), config(false)), { code: 'ENOENT' });
});
