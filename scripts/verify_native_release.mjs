/** Read-only native build gates. Never sign, link accounts, or publish. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function verifyAndroidBuildReadiness({ env = process.env, bundled, now = Date.now(), fetcher, timeoutMs } = {}) {
  // Keep TypeScript out of the iOS skip path, including on an older image Node.
  const [{ androidReleaseSettings }, { fetchPropertySnapshot }, { parseSnapshot }] = await Promise.all([
    import('../src/androidReleaseConfig.ts'), import('../src/inventoryFeed.ts'), import('../src/properties.ts'),
  ]);
  // Enforce the same identity gate for a manually invoked check and an EAS build.
  const settings = androidReleaseSettings({ ...env, EAS_BUILD_PLATFORM: 'android' });
  const fallback = parseSnapshot(bundled);
  const { inventoryIsCurrent } = await import('../src/inventoryFreshness.ts');
  if (!inventoryIsCurrent(fallback.checkedAt, now)) {
    throw new Error('Android bundled inventory is not current. Run npm run sync:properties and validate the new snapshot before building.');
  }
  // A compiled bundle is not proof that installed apps can update. Require the
  // actual public feed to pass the same validation used by the native client.
  const published = await fetchPropertySnapshot(fallback, { now, fetcher, timeoutMs });
  return {
    packageName: settings.packageName,
    versionCode: settings.versionCode,
    bundledCheckedAt: fallback.checkedAt,
    publishedCheckedAt: published.checkedAt,
    bundledPropertyCount: fallback.properties.length,
    publishedPropertyCount: published.properties.length,
  };
}

export async function verifyIosBuildReadiness({ env = process.env, bundled, now = Date.now(), fetcher, timeoutMs } = {}) {
  const [{ iosReleaseSettings }, { fetchPropertySnapshot }, { parseSnapshot }] = await Promise.all([
    import('../src/iosReleaseConfig.ts'), import('../src/inventoryFeed.ts'), import('../src/properties.ts'),
  ]);
  const settings = iosReleaseSettings({ ...env, EAS_BUILD_PLATFORM: 'ios', EAS_BUILD_PROFILE: 'ios-production' });
  const fallback = parseSnapshot(bundled);
  const { inventoryIsCurrent } = await import('../src/inventoryFreshness.ts');
  if (!inventoryIsCurrent(fallback.checkedAt, now)) {
    throw new Error('iOS bundled inventory is not current. Refresh and validate the snapshot before building.');
  }
  const published = await fetchPropertySnapshot(fallback, { now, fetcher, timeoutMs });
  return { ...settings, bundledCheckedAt: fallback.checkedAt, publishedCheckedAt: published.checkedAt,
    bundledPropertyCount: fallback.properties.length, publishedPropertyCount: published.properties.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hook = process.argv.includes('--eas-hook');
  const platform = process.env.EAS_BUILD_PLATFORM;
  const simulator = platform === 'ios' && process.env.EAS_BUILD_PROFILE === 'ios-simulator';
  if (hook && simulator) {
    console.log('Device release gate skipped for the named iOS simulator profile.');
  } else if (hook && !['android', 'ios'].includes(platform)) {
    console.error('Native build readiness failed: unknown EAS build platform.');
    process.exitCode = 1;
  } else {
    const ios = platform === 'ios' || process.argv.includes('--ios');
    try {
      const bundled = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url), 'utf8'));
      const verify = ios ? verifyIosBuildReadiness : verifyAndroidBuildReadiness;
      console.log(JSON.stringify(await verify({ bundled }), null, 2));
    } catch (error) {
      console.error(`${ios ? 'iOS' : 'Android'} build readiness failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
