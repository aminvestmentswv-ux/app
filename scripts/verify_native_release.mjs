/** Read-only Android build gate. Never signs, links an account, or publishes. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function verifyAndroidBuildReadiness({ env = process.env, bundled, now = Date.now(), fetcher, timeoutMs } = {}) {
  // Keep TypeScript out of the iOS skip path, including on an older image Node.
  const [{ androidReleaseSettings }, { fetchPropertySnapshot, MAX_INVENTORY_AGE_MS }, { parseSnapshot }] = await Promise.all([
    import('../src/androidReleaseConfig.ts'), import('../src/inventoryFeed.ts'), import('../src/properties.ts'),
  ]);
  // Enforce the same identity gate for a manually invoked check and an EAS build.
  const settings = androidReleaseSettings({ ...env, EAS_BUILD_PLATFORM: 'android' });
  const fallback = parseSnapshot(bundled);
  const age = now - Date.parse(fallback.checkedAt);
  if (age < -300_000 || age > MAX_INVENTORY_AGE_MS) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // The EAS lifecycle invokes this hook for both platforms. The standalone
  // command remains available as an explicit Android check without EAS access.
  if (process.argv.includes('--eas-hook') && process.env.EAS_BUILD_PLATFORM !== 'android') {
    console.log('Android inventory build gate skipped for a non-Android build.');
  } else {
    const bundled = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url), 'utf8'));
    try {
      console.log(JSON.stringify(await verifyAndroidBuildReadiness({ bundled }), null, 2));
    } catch (error) {
      console.error(`Android build readiness failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
