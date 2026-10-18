import { useState } from 'react';
import { Linking, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import { shareContent, shareTargets } from './sharing';
import type { SaleProperty } from './properties';
import { styles } from './styles';

export function ShareButton({ property }: { property?: SaleProperty }) {
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const content = shareContent(property);
  const web = Platform.OS === 'web';
  const apple = Platform.OS === 'ios' || (web && typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  const targets = shareTargets(content, apple);
  const hasDeviceShare = !web || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  async function deviceShare() {
    setFeedback('');
    try {
      if (web) await navigator.share(content);
      else await Share.share({
        title: content.title,
        message: apple ? content.text : `${content.text}\n${content.url}`,
        ...(apple ? { url: content.url } : {}),
      });
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        setFeedback('Choose an option below, or copy the link to share it.');
      }
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(content.url);
      setFeedback('Link copied! Paste it into a message or social post.');
    } catch {
      setFeedback('Select and copy the link below.');
    }
  }

  async function openTarget(target: keyof typeof targets) {
    setFeedback('');
    try { await Linking.openURL(targets[target]); }
    catch { setFeedback('This option could not open. Try another option or copy the link below.'); }
  }

  return (
    <View style={styles.shareSection}>
      <Pressable accessibilityRole="button" accessibilityLabel={property ? 'Share this property' : 'Share app'} accessibilityState={{ expanded }} onPress={() => { setExpanded(!expanded); setFeedback(''); }} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>{property ? 'Share this property' : 'Share app'} ↗</Text>
      </Pressable>
      {expanded ? <View style={styles.sharePanel}>
        <Text style={styles.shareTitle}>{property ? 'Send this property to someone' : 'Share AM Investments'}</Text>
        <Text style={styles.description}>Choose how to share the link.</Text>
        <View style={styles.shareOptions}>
          {(['email', 'sms', 'facebook', 'whatsapp', 'x'] as const).map((target) => (
            <Pressable key={target} accessibilityRole="link" accessibilityLabel={`Share by ${{ email: 'email', sms: 'text message', facebook: 'Facebook', whatsapp: 'WhatsApp', x: 'X' }[target]}`} onPress={() => void openTarget(target)} style={styles.shareOption}>
              <Text style={styles.cardLinkText}>{{ email: 'Email', sms: 'Text message', facebook: 'Facebook', whatsapp: 'WhatsApp', x: 'X' }[target]}</Text>
            </Pressable>
          ))}
        </View>
        {hasDeviceShare ? <Pressable accessibilityRole="button" onPress={() => void deviceShare()} style={styles.secondaryButton}><Text style={styles.cardLinkText}>More sharing options</Text></Pressable> : null}
        {web ? <Pressable accessibilityRole="button" onPress={() => void copyLink()} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Copy link</Text></Pressable> : null}
        <TextInput accessibilityLabel={property ? 'Property share link' : 'App share link'} value={content.url} editable={false} selectTextOnFocus style={styles.shareLink} />
        {feedback ? <Text accessibilityLiveRegion="polite" style={styles.shareFeedback}>{feedback}</Text> : null}
      </View> : null}
    </View>
  );
}
