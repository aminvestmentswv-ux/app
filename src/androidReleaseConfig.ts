// No package ID, privacy policy URL, signing key or Expo account is guessed here.
export function androidReleaseSettings(env: Record<string, string | undefined>) {
  const packageName = env.AM_ANDROID_PACKAGE;
  const versionText = env.AM_ANDROID_VERSION_CODE;
  const privacyUrl = env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
  const required = env.EAS_BUILD_PLATFORM === 'android';
  if (required && (!packageName || !versionText || !privacyUrl)) {
    throw new Error('Android builds require the confirmed AM_ANDROID_PACKAGE, AM_ANDROID_VERSION_CODE and EXPO_PUBLIC_PRIVACY_POLICY_URL.');
  }
  if (packageName === 'com.aminvestments.nativeqatest') {
    throw new Error('Use the confirmed production Android package, not the disposable QA identifier');
  }
  if (packageName && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) throw new Error('Invalid Android package identifier');
  if (versionText && (!/^\d+$/.test(versionText) || Number(versionText) < 1 || Number(versionText) > 2_100_000_000)) throw new Error('Invalid Android version code');
  if (privacyUrl) {
    const url = new URL(privacyUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.hostname !== 'www.aminvestmentswv.com') {
      throw new Error('Use a verified HTTPS privacy policy on the official AM Investments website');
    }
  }
  return { packageName, versionCode: versionText ? Number(versionText) : undefined };
}
