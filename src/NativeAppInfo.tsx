import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import { styles } from './styles';
import { COMPANY_WEBSITE } from './properties';
import { openLink } from './components';

const privacyUrl = process.env.EXPO_PUBLIC_AM_PRIVACY_URL;

export function NativeAppInfo() {
  if (Platform.OS === 'web') return null;
  async function openPrivacy() {
    try {
      const url = new URL(privacyUrl ?? '');
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid policy URL');
      await Linking.openURL(url.href);
    } catch {
      Alert.alert('Privacy policy unavailable', 'Please contact AM Investments through the official website.');
    }
  }
  return <View>
    <Text style={styles.footerDescription}>Browse without creating an account. Sharing opens your selected app; you choose whether to send. Maps use the published property address.</Text>
    {privacyUrl ? <Pressable accessibilityRole="link" onPress={() => void openPrivacy()} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Privacy policy</Text></Pressable> : null}
    <Pressable accessibilityRole="link" onPress={() => void openLink(COMPANY_WEBSITE)} style={styles.secondaryButton}><Text style={styles.cardLinkText}>App support</Text></Pressable>
  </View>;
}
