// Production identifiers must come from the existing approved Apple app record.
// The named simulator profile is never a device-distribution profile.
export function iosReleaseSettings(env: Record<string, string | undefined>) {
  const bundleIdentifier = env.AM_IOS_BUNDLE_IDENTIFIER;
  const buildNumber = env.AM_IOS_BUILD_NUMBER;
  const privacyUrl = env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const required = env.EAS_BUILD_PLATFORM === 'ios' && env.EAS_BUILD_PROFILE !== 'ios-simulator';
  if (required && (!bundleIdentifier || !buildNumber || !privacyUrl)) {
    throw new Error('iOS device builds require the confirmed AM_IOS_BUNDLE_IDENTIFIER, AM_IOS_BUILD_NUMBER and EXPO_PUBLIC_PRIVACY_POLICY_URL.');
  }
  if (bundleIdentifier && (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(bundleIdentifier) || bundleIdentifier === 'com.aminvestments.nativeqatest')) {
    throw new Error('Use the confirmed production iOS bundle identifier, not the disposable QA identifier');
  }
  // Deliberately use a simple positive integer for predictable App Store uploads.
  if (buildNumber && (!/^[1-9]\d{0,3}$/.test(buildNumber))) throw new Error('Use a positive iOS build number of at most four digits');
  if (privacyUrl) {
    const url = new URL(privacyUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname !== 'www.aminvestmentswv.com') {
      throw new Error('Use a verified HTTPS privacy policy on the official AM Investments website');
    }
  }
  return { bundleIdentifier, buildNumber };
}
