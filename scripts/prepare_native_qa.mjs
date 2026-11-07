/** Generates only disposable native test builds. No signing, deployment or accounts. */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function prepareNativeQa(root, env = process.env, platform) {
  if (env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted' ||
      env.GITHUB_REPOSITORY !== 'aminvestmentswv-ux/app' ||
      env.GITHUB_REF !== 'refs/heads/test/native-live-feed-2026-11-07') {
    throw new Error('QA preparation requires the approved isolated hosted test branch');
  }
  if (!['android', 'ios'].includes(platform)) throw new Error('Expected --platform android or ios');
  if (env.EAS_BUILD_PLATFORM || env.AM_ANDROID_PACKAGE || env.EXPO_PUBLIC_ONESIGNAL_APP_ID) {
    throw new Error('Do not combine QA preparation with production build identity or notifications');
  }
  const identity = platform === 'android' ? env.AM_TEST_PACKAGE : env.AM_TEST_IOS_BUNDLE_ID;
  if (identity !== 'com.aminvestments.nativeqatest') throw new Error('Unexpected native test identity');
  const file = (name) => path.join(root, name);
  const config = JSON.parse(fs.readFileSync(file('app.json'), 'utf8'));
  const app = fs.readFileSync(file('App.tsx'), 'utf8');
  const index = fs.readFileSync(file('index.ts'), 'utf8');
  const marker = '<SafeAreaProvider><PropertyApp /></SafeAreaProvider>';
  if (app.split(marker).length !== 2 || index.includes('native_qa_adapter')) throw new Error('Unrecognized or already instrumented source');
  config.expo.name = 'AM Native QA Test';
  config.expo.scheme = 'am-native-qa';
  if (platform === 'android') config.expo.android = { ...config.expo.android, package: identity };
  else config.expo.ios = { ...config.expo.ios, bundleIdentifier: identity };
  fs.writeFileSync(file('app.json'), JSON.stringify(config, null, 2) + '\n');
  fs.writeFileSync(file('index.ts'), "import './scripts/native_qa_adapter';\n" + index);
  fs.writeFileSync(file('App.tsx'), "import { NativeQaStatus } from './scripts/native_qa_adapter';\n" + app.replace(marker, '<SafeAreaProvider><PropertyApp /><NativeQaStatus /></SafeAreaProvider>'));
  console.log('Prepared isolated native QA identity and feed-only fault injection; no network settings changed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareNativeQa(process.cwd(), process.env, process.argv[process.argv.indexOf('--platform') + 1]);
}
