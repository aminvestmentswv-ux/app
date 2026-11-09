import type { ConfigContext, ExpoConfig } from 'expo/config';
// Expo config is evaluated by Node before Metro starts.
import { androidReleaseSettings } from './src/androidReleaseConfig.ts';
import { iosAppTransportSecurity, iosReleaseSettings } from './src/iosReleaseConfig.ts';

export default ({ config }: ConfigContext): ExpoConfig => {
  const basePath = process.env.AM_APP_WEB_BASE_PATH;
  const android = androidReleaseSettings(process.env);
  const ios = iosReleaseSettings(process.env);
  return {
    ...config,
    name: config.name ?? 'AM Investments app',
    slug: config.slug ?? 'am-investments',
    ios: {
      ...config.ios,
      ...(ios.bundleIdentifier ? { bundleIdentifier: ios.bundleIdentifier } : {}),
      ...(ios.buildNumber ? { buildNumber: ios.buildNumber } : {}),
      infoPlist: {
        ...config.ios?.infoPlist,
        // Replace the entire ATS dictionary so template/config exceptions cannot
        // silently relax the release policy. Other plist settings are preserved.
        NSAppTransportSecurity: iosAppTransportSecurity(process.env),
      },
    },
    android: {
      ...config.android,
      ...(android.packageName ? { package: android.packageName } : {}),
      ...(android.versionCode ? { versionCode: android.versionCode } : {}),
      // This browsing app does not need microphone, storage or notifications.
      blockedPermissions: [...new Set([...(config.android?.blockedPermissions ?? []),
        'android.permission.RECORD_AUDIO', 'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE', 'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.POST_NOTIFICATIONS'])],
    },
    plugins: [...(config.plugins ?? []), ['expo-build-properties', {
      android: { targetSdkVersion: 36, usesCleartextTraffic: false },
    }]],
    ...(basePath ? { experiments: { ...config.experiments, baseUrl: basePath } } : {}),
  };
};
