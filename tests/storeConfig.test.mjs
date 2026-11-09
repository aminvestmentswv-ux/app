import assert from 'node:assert/strict';
import test from 'node:test';
import configure from '../app.config.ts';

test('store builds require registered configuration without changing ordinary web builds', () => {
  const keys = ['AM_APP_WEB_BASE_PATH', 'AM_IOS_BUNDLE_IDENTIFIER', 'AM_ANDROID_PACKAGE', 'AM_EAS_PROJECT_ID', 'EXPO_PUBLIC_AM_PRIVACY_URL', 'EAS_BUILD_PROFILE'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const base = { config: { name: 'Existing app', slug: 'existing', ios: { supportsTablet: true }, experiments: { typedRoutes: false } } };
  try {
    keys.forEach((key) => delete process.env[key]);
    const web = configure(base);
    assert.equal(web.name, 'Existing app');
    assert.equal(web.ios.supportsTablet, true);
    assert.equal(web.ios.bundleIdentifier, undefined);
    assert.equal(web.android.package, undefined);
    process.env.EAS_BUILD_PROFILE = 'production';
    assert.throws(() => configure(base), /Store builds need/);
    process.env.AM_IOS_BUNDLE_IDENTIFIER = 'com.example.fixture';
    process.env.AM_ANDROID_PACKAGE = 'com.example.fixture';
    process.env.AM_EAS_PROJECT_ID = '00000000-0000-4000-8000-000000000000';
    process.env.EXPO_PUBLIC_AM_PRIVACY_URL = 'http://example.com/privacy';
    assert.throws(() => configure(base), /must use HTTPS/);
    process.env.EXPO_PUBLIC_AM_PRIVACY_URL = 'https://user:password@example.com/privacy';
    assert.throws(() => configure(base), /without credentials/);
    process.env.EXPO_PUBLIC_AM_PRIVACY_URL = 'https://example.com/privacy';
    process.env.AM_APP_WEB_BASE_PATH = '/app';
    const production = configure(base);
    assert.equal(production.ios.bundleIdentifier, 'com.example.fixture');
    assert.equal(production.android.package, 'com.example.fixture');
    assert.equal(production.extra.eas.projectId, process.env.AM_EAS_PROJECT_ID);
    assert.equal(production.experiments.baseUrl, '/app');
    assert.equal(production.experiments.typedRoutes, false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
