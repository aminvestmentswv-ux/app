import type { PushSDK } from './notificationPreferences';

export const PUSH_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID?.trim() || '';
export const PUSH_PAUSED_FOR_TEST = typeof window !== 'undefined' && typeof window.location?.search === 'string' && new URLSearchParams(window.location.search).get('am-push') === 'off';
type PushWindow = Window & { OneSignalDeferred?: Array<(sdk: PushSDK) => Promise<void>> };
let initialization: Promise<PushSDK> | undefined;

export function loadWebPush(): Promise<PushSDK> {
  if (PUSH_PAUSED_FOR_TEST) return Promise.reject(new Error('Notifications are paused for this troubleshooting test.'));
  if (!PUSH_APP_ID) return Promise.reject(new Error('Push notifications are coming soon. Your preference can still be saved.'));
  if (window.location.origin !== 'https://app.aminvestmentswv.com') {
    return Promise.reject(new Error('Property notifications are available at app.aminvestmentswv.com.'));
  }
  if (initialization) return initialization;
  initialization = new Promise<PushSDK>((resolve, reject) => {
    const browser = window as PushWindow;
    const timeout = window.setTimeout(() => reject(new Error('Notifications could not connect. Please try again.')), 15000);
    browser.OneSignalDeferred = browser.OneSignalDeferred || [];
    browser.OneSignalDeferred.push(async (sdk) => {
      try {
        await sdk.init({
          appId: PUSH_APP_ID,
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          autoResubscribe: false,
          notifyButton: { enable: false },
          welcomeNotification: { disable: true },
          promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
        });
        window.clearTimeout(timeout);
        resolve(sdk);
      } catch {
        window.clearTimeout(timeout);
        reject(new Error('Notifications could not connect. Please try again later.'));
      }
    });
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error('Notifications could not load. Check your connection and try again.')); };
    document.head.appendChild(script);
  });
  return initialization;
}
