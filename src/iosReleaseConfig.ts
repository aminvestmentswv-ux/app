// Production identifiers must come from the existing approved Apple app record.
// The named simulator profile is never a device-distribution profile.
function isIosDeviceBuild(env: Record<string, string | undefined>) {
  // EAS can evaluate config locally before EAS_BUILD_PLATFORM is available.
  return env.EAS_BUILD_PROFILE === 'ios-production'
    || (env.EAS_BUILD_PLATFORM === 'ios' && env.EAS_BUILD_PROFILE !== 'ios-simulator');
}

export function iosAppTransportSecurity(env: Record<string, string | undefined>) {
  return {
    NSAllowsArbitraryLoads: false,
    // Keep Expo's local Metro allowance for local development / the named
    // simulator profile only. Device-distribution builds need HTTPS throughout.
    NSAllowsLocalNetworking: !isIosDeviceBuild(env),
  };
}

export function iosReleaseSettings(env: Record<string, string | undefined>) {
  const bundleIdentifier = env.AM_IOS_BUNDLE_IDENTIFIER;
  const buildNumber = env.AM_IOS_BUILD_NUMBER;
  const privacyUrl = env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const required = isIosDeviceBuild(env);
  if (required && (!bundleIdentifier || !buildNumber || !privacyUrl)) {
    throw new Error('iOS device builds require the confirmed AM_IOS_BUNDLE_IDENTIFIER, AM_IOS_BUILD_NUMBER and EXPO_PUBLIC_PRIVACY_POLICY_URL.');
  }
  if (bundleIdentifier?.toLowerCase() === 'com.placeholder.appid') {
    throw new Error('Use the confirmed production iOS bundle identifier, not the Expo placeholder identifier');
  }
  if (bundleIdentifier && (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(bundleIdentifier) || bundleIdentifier.toLowerCase() === 'com.aminvestments.nativeqatest')) {
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
