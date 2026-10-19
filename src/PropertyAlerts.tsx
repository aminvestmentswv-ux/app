import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { applyPushPreference, NOTIFICATION_CHOICES, parseNotificationPreference, PREFERENCE_KEY, type NotificationPreference, type PushSDK } from './notificationPreferences';
import { loadWebPush, PUSH_APP_ID } from './webPush';
import { styles } from './styles';

function readSaved(key: string): string | null {
  try { return Platform.OS === 'web' ? window.localStorage.getItem(key) : null; }
  catch { return null; }
}

function save(key: string, value: string): boolean {
  try { window.localStorage.setItem(key, value); return true; }
  catch { return false; }
}

export function PropertyAlerts() {
  const [preference, setPreference] = useState<NotificationPreference>(() => parseNotificationPreference(readSaved(PREFERENCE_KEY)));
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(Boolean(PUSH_APP_ID));
  const [feedback, setFeedback] = useState('');
  const [sdk, setSDK] = useState<PushSDK>();

  useEffect(() => {
    // Initialization has automatic prompts disabled; only the Enable action may opt in.
    if (!PUSH_APP_ID || Platform.OS !== 'web') return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void loadWebPush().then(async (instance) => {
      const subscribed = await applyPushPreference(instance, preference);
      if (active) {
        setSDK(instance);
        setEnabled(subscribed);
        const changed = () => {
          if (!active) return;
          const optedIn = instance.User.PushSubscription.optedIn === true;
          setEnabled(optedIn);
          setFeedback(optedIn ? 'Property notifications are enabled for your selection.' : 'Property notifications are off.');
        };
        instance.User.PushSubscription.addEventListener?.('change', changed);
        unsubscribe = () => instance.User.PushSubscription.removeEventListener?.('change', changed);
      }
    }).catch(() => { if (active) setFeedback('Your choice is saved. Notifications could not connect right now.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; unsubscribe?.(); };
    // Subsequent choices are applied by the user's action below, without reinitializing.
  }, []);

  if (Platform.OS !== 'web') return null;

  const choose = async (choice: NotificationPreference) => {
    setPreference(choice);
    const persisted = save(PREFERENCE_KEY, choice);
    setFeedback(persisted ? (choice === 'none' ? 'Preference saved: no property notifications.' : 'Preference saved on this device.') : 'Your choice applies for this visit. This browser could not save it for next time.');
    if (!PUSH_APP_ID) return;
    setBusy(true);
    try {
      const subscribed = await applyPushPreference(await loadWebPush(), choice);
      setEnabled(subscribed);
    } catch {
      setFeedback('Your choice is saved here, but could not be synced. Try again; to stop alerts immediately, turn off notifications for this site in your browser settings.');
    } finally { setBusy(false); }
  };

  const enable = async () => {
    if (preference === 'none') return;
    if (!sdk) { setFeedback('Notifications are still connecting. Please try again shortly.'); return; }
    setBusy(true);
    try {
      const subscribed = await applyPushPreference(sdk, preference, true);
      setEnabled(subscribed);
      setFeedback(subscribed ? 'Property notifications are enabled for your selection.' :
        typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'Permission granted. Connecting your notification subscription…' :
        'Notifications are not enabled. Allow them in your browser settings to receive property alerts.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Notifications could not connect. Please try again later.');
    } finally { setBusy(false); }
  };

  return (
    <View style={styles.alertsSection}>
      <Text accessibilityRole="header" style={styles.homeScreenTitle}>Property alerts</Text>
      <Text style={styles.description}>Which properties would you like push notifications about?</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Property notification preference" style={styles.alertChoices}>
        {NOTIFICATION_CHOICES.map((choice) => (
          <Pressable key={choice.value} accessibilityRole="radio" accessibilityLabel={choice.label} accessibilityState={{ checked: preference === choice.value, disabled: busy }} aria-checked={preference === choice.value} disabled={busy} onPress={() => void choose(choice.value)} style={({ pressed }) => [styles.alertChoice, preference === choice.value && styles.activeTab, pressed && styles.pressed]}>
            <Text style={[styles.tabText, preference === choice.value && styles.activeTabText]}>{choice.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.alertsHint}>{!PUSH_APP_ID ? 'Push notifications are not available yet. You can save your preference now.' : preference === 'none' ? 'No property notifications selected.' : enabled ? 'Notifications are on for your selection.' : 'Enable notifications to receive alerts. On iPhone, add this app to your Home Screen and open its icon first.'}</Text>
      {PUSH_APP_ID && preference !== 'none' && !enabled ? <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => void enable()} style={[styles.secondaryButton, busy && styles.pressed]}><Text style={styles.cardLinkText}>{busy ? 'Connecting…' : 'Enable notifications'}</Text></Pressable> : null}
      {feedback ? <Text accessibilityLiveRegion="polite" style={styles.alertsHint}>{feedback}</Text> : null}
    </View>
  );
}
