import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const basePath = process.env.AM_APP_WEB_BASE_PATH;
  const bundleIdentifier = process.env.AM_IOS_BUNDLE_IDENTIFIER;
  const androidPackage = process.env.AM_ANDROID_PACKAGE;
  const projectId = process.env.AM_EAS_PROJECT_ID ?? '2a076a64-b41c-4889-bc6b-83dadf3d9209';
  const privacyUrl = process.env.EXPO_PUBLIC_AM_PRIVACY_URL;
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const platform = process.env.EAS_BUILD_PLATFORM;
    if ((platform !== 'android' && !bundleIdentifier) || (platform !== 'ios' && !androidPackage) || !projectId || !privacyUrl) {
      throw new Error('Store builds need the platform app identifier (AM_IOS_BUNDLE_IDENTIFIER / AM_ANDROID_PACKAGE), AM_EAS_PROJECT_ID and EXPO_PUBLIC_AM_PRIVACY_URL. See docs/STORE_SUBMISSION.md.');
    }
    const policy = new URL(privacyUrl);
    if (policy.protocol !== 'https:' || policy.username || policy.password) throw new Error('The published privacy policy must use HTTPS without credentials.');
  }
  return {
    ...config,
    name: config.name ?? 'AM Investments app',
    slug: config.slug ?? 'am-investments',
    owner: 'am-investments-wv',
    ios: { ...config.ios, ...(bundleIdentifier ? { bundleIdentifier } : {}) },
    android: {
      ...config.android,
      ...(androidPackage ? { package: androidPackage } : {}),
      blockedPermissions: [...new Set([
        ...(config.android?.blockedPermissions ?? []),
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.VIBRATE',
      ])],
    },
    extra: { ...config.extra, ...(projectId ? { eas: { projectId } } : {}) },
    ...(basePath ? { experiments: { ...config.experiments, baseUrl: basePath } } : {}),
  };
};
