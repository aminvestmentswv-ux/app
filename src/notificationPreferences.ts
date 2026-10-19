export const NOTIFICATION_CHOICES = [
  { value: 'available', label: 'Available' },
  { value: 'coming-soon', label: 'Coming Soon' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'None' },
] as const;

export type NotificationPreference = (typeof NOTIFICATION_CHOICES)[number]['value'];
export const PREFERENCE_KEY = 'am-property-alert-preference-v1';

export function parseNotificationPreference(value: unknown): NotificationPreference {
  return NOTIFICATION_CHOICES.some((choice) => choice.value === value) ? value as NotificationPreference : 'both';
}

export function notificationTags(preference: NotificationPreference): Record<string, string> {
  return {
    am_available: preference === 'available' || preference === 'both' ? '1' : '0',
    am_coming_soon: preference === 'coming-soon' || preference === 'both' ? '1' : '0',
  };
}

export type PushSDK = {
  init: (options: Record<string, unknown>) => Promise<void>;
  Notifications: { isPushSupported: () => boolean };
  User: {
    addTags: (tags: Record<string, string>) => void | Promise<void>;
    PushSubscription: {
      optedIn?: boolean;
      optIn: () => void | Promise<void>;
      optOut: () => void | Promise<void>;
      addEventListener?: (event: 'change', callback: () => void) => void;
      removeEventListener?: (event: 'change', callback: () => void) => void;
    };
  };
};

// Preference changes never request permission. Only the explicit Enable action may opt in.
export async function applyPushPreference(sdk: PushSDK, preference: NotificationPreference, enable = false): Promise<boolean> {
  if (preference === 'none') {
    await sdk.User.PushSubscription.optOut();
    await sdk.User.addTags(notificationTags(preference));
    return false;
  }
  if (enable) {
    if (!sdk.Notifications.isPushSupported()) {
      throw new Error('Push is not supported in this browser. On iPhone, add this app to your Home Screen and open its icon first.');
    }
    await sdk.User.PushSubscription.optIn();
  }
  await sdk.User.addTags(notificationTags(preference));
  return sdk.User.PushSubscription.optedIn === true;
}
