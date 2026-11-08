import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { buyerAgentLink, parseBuyerAgent } from './buyerAgent';
import type { BuyerAgentController } from './buyerAgentStore';
import type { SaleProperty } from './properties';
import { colors, styles } from './styles';

export function BuyerAgentContact({ property, contact }: {
  property: SaleProperty; contact: BuyerAgentController;
}) {
  const { agent, ready, saving } = contact;
  const apple = Platform.OS === 'ios' || (Platform.OS === 'web' && typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent?.name ?? '');
  const [phone, setPhone] = useState(agent?.phone ?? '');
  const [feedback, setFeedback] = useState('');
  const [opening, setOpening] = useState(false);
  const pending = useRef(false);
  const busy = !ready || saving || opening;
  const edit = () => { setName(agent?.name ?? ''); setPhone(agent?.phone ?? ''); setFeedback(''); setEditing(true); };
  const save = async () => {
    if (busy || pending.current) return;
    pending.current = true;
    try {
      const next = parseBuyerAgent(name, phone);
      setFeedback('');
      if (await contact.update(next)) { setEditing(false); setName(''); setPhone(''); }
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Check the phone number.'); }
    finally { pending.current = false; }
  };
  const clear = async () => {
    if (busy || pending.current) return;
    pending.current = true; setFeedback('');
    try {
      if (await contact.update(null)) { setName(''); setPhone(''); setEditing(false); }
    } finally { pending.current = false; }
  };
  const open = async (action: 'call' | 'text') => {
    if (!agent || busy || pending.current) return;
    pending.current = true;
    setOpening(true); setFeedback('');
    try {
      await Linking.openURL(buyerAgentLink(agent, action, property, apple));
      setFeedback(action === 'text' ? 'Complete or cancel the message in your messaging app.' : 'Complete or cancel the call in your phone app.');
    } catch {
      setFeedback(`Could not open a ${action === 'text' ? 'messaging' : 'phone'} app. You can contact your agent at ${agent.phone}.`);
    } finally { pending.current = false; setOpening(false); }
  };
  const disabled = { disabled: busy, accessibilityState: { disabled: busy } };
  return <View style={styles.specificationsSection}>
    <Text accessibilityRole="header" style={styles.specificationsTitle}>Your own agent</Text>
    <Text style={styles.description}>Save a number you know belongs to your agent for future properties. Stored in this app on your device, not sent to AM Investments. Your device backup may include it. No contacts permission is needed.</Text>
    {!ready ? <Text accessibilityLiveRegion="polite" style={styles.noteText}>Loading saved agent…</Text> : editing ? <View style={{ gap: 8, marginTop: 12 }}>
      <TextInput accessibilityLabel="Your agent name (optional)" placeholder="Agent name (optional)" placeholderTextColor={colors.muted} value={name} onChangeText={setName} editable={!busy} maxLength={80} style={styles.searchInput} />
      <TextInput accessibilityLabel="Your agent US or Canada phone number" placeholder="US or Canada phone number" placeholderTextColor={colors.muted} value={phone} onChangeText={setPhone} editable={!busy} keyboardType="phone-pad" autoComplete="off" maxLength={30} style={styles.searchInput} />
      <Pressable accessibilityRole="button" {...disabled} onPress={() => void save()} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Save agent on this device</Text></Pressable>
      <Pressable accessibilityRole="button" {...disabled} onPress={() => { setEditing(false); setName(''); setPhone(''); setFeedback(''); }} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Cancel agent edit</Text></Pressable>
    </View> : agent ? <View>
      <Text style={styles.description}>{agent.name || 'Your agent'} · {agent.phone}</Text>
      <Text style={styles.description}>These actions open your phone or message composer. Messages are not sent automatically.</Text>
      <Pressable accessibilityRole="button" {...disabled} onPress={() => void open('call')} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Call your agent</Text></Pressable>
      <Pressable accessibilityRole="button" {...disabled} onPress={() => void open('text')} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Text your agent about this property</Text></Pressable>
      <Pressable accessibilityRole="button" {...disabled} onPress={edit} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Edit your agent</Text></Pressable>
      <Pressable accessibilityRole="button" {...disabled} onPress={() => void clear()} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Clear your agent</Text></Pressable>
    </View> : <View>
      <Pressable accessibilityRole="button" {...disabled} onPress={edit} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Add your agent</Text></Pressable>
      {contact.feedback ? <Pressable accessibilityRole="button" {...disabled} onPress={() => void clear()} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Clear saved contact</Text></Pressable> : null}
    </View>}
    {saving ? <Text accessibilityLiveRegion="polite" style={styles.noteText}>Saving contact change…</Text> : null}
    {feedback || contact.feedback ? <Text accessibilityLiveRegion="polite" style={styles.noteText}>{feedback || contact.feedback}</Text> : null}
  </View>;
}
