import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { listingAgentLink } from './listingAgent';
import type { SaleProperty } from './properties';
import { STATUS_LABELS } from './properties';
import { styles } from './styles';

export function ListingAgentContact({ property }: { property: SaleProperty }) {
  const [feedback, setFeedback] = useState('');
  const [opening, setOpening] = useState(false);
  const pending = useRef(false);
  const agent = property.listingAgent;
  const apple = Platform.OS === 'ios' || (Platform.OS === 'web' && typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  const open = async (action: 'call' | 'text') => {
    if (!agent || pending.current) return;
    pending.current = true; setOpening(true); setFeedback('');
    try {
      await Linking.openURL(listingAgentLink(property, action, apple));
      setFeedback(action === 'text' ? 'Complete or cancel the message in your messaging app.' : 'Complete or cancel the call in your phone app.');
    } catch {
      setFeedback(`Could not open a ${action === 'text' ? 'messaging' : 'phone'} app. The published contact number is ${agent.phone}.`);
    } finally { pending.current = false; setOpening(false); }
  };
  return <View style={styles.specificationsSection}>
    <Text accessibilityRole="header" style={styles.specificationsTitle}>Listing agent</Text>
    {agent ? <View>
      <Text style={styles.description}>{agent.name} · {agent.phone}</Text>
      <Text style={styles.noteText}>Contact attribution from this property's saved original listing. Status in saved inventory: {STATUS_LABELS[property.status]}. Contact details and availability may have changed; confirm before relying on them.</Text>
      <Text style={styles.description}>These actions open your phone or message composer. Messages are not sent automatically. A published call/text invitation is not a live check that the number still belongs to the agent.</Text>
      <Pressable accessibilityRole="button" disabled={opening} accessibilityState={{ disabled: opening }} onPress={() => void open('call')} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Call listing agent</Text></Pressable>
      {agent.textEvidence ? <Pressable accessibilityRole="button" disabled={opening} accessibilityState={{ disabled: opening }} onPress={() => void open('text')} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Text listing agent about this property</Text></Pressable> : <Text style={styles.noteText}>A verified texting number is not published for this property.</Text>}
    </View> : <Text style={styles.description}>A verified listing-agent contact is not available for this property. Check the original listing or contact your own agent below.</Text>}
    {feedback ? <Text accessibilityLiveRegion="polite" style={styles.noteText}>{feedback}</Text> : null}
  </View>;
}
