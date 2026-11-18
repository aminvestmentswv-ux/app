import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { styles } from './styles';

export type WatchClient = {
  // May be true only after rollout and verified device enrollment, never localStorage alone.
  ready: boolean;
  setWatching(propertyId: string, enabled: boolean): Promise<{ watching: boolean }>;
};
/** Unmounted candidate. No watch promise is displayed before a real ready service exists. */
export function WatchPropertyButton({ propertyId, client, initiallyWatching = false }: {
  propertyId: string; client: WatchClient; initiallyWatching?: boolean;
}) {
  const [watching, setWatching] = useState(initiallyWatching);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (Platform.OS !== 'web' || !client.ready) return null;
  const toggle = async () => {
    setBusy(true);
    try {
      const result = await client.setWatching(propertyId, !watching);
      setWatching(result.watching);
      setMessage(result.watching ? 'Watching on this device. We will notify you of future price drops.' : 'Stopped watching on this device.');
    } catch {
      setMessage('Your change could not be confirmed. Please try again. To stop all alerts immediately, turn off this site’s notifications in your browser.');
    } finally { setBusy(false); }
  };
  return <View>
    <Text style={styles.description}>Optional price-drop alerts for this property on this device. Stop watching anytime.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={toggle} style={styles.secondaryButton}>
      <Text style={styles.cardLinkText}>{busy ? 'Saving…' : watching ? 'Stop watching' : '👁️ Watch this property'}</Text>
    </Pressable>
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.description}>{message}</Text>}
  </View>;
}
