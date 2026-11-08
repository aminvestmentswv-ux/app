import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { buyerAgentLink, parseBuyerAgent, type BuyerAgent } from './buyerAgent';
import type { SaleProperty } from './properties';
import { colors, styles } from './styles';

export function BuyerAgentContact({ property, agent, onChange }: {
  property: SaleProperty; agent: BuyerAgent | null; onChange: (agent: BuyerAgent | null) => void;
}) {
  const apple = Platform.OS === 'ios' || (Platform.OS === 'web' && typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent?.name ?? '');
  const [phone, setPhone] = useState(agent?.phone ?? '');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const opening = useRef(false);
  const edit = () => { setName(agent?.name ?? ''); setPhone(agent?.phone ?? ''); setFeedback(''); setEditing(true); };
  const save = () => {
    try { onChange(parseBuyerAgent(name, phone)); setEditing(false); setFeedback('Agent set for this app session.'); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Check the phone number.'); }
  };
  const open = async (action: 'call' | 'text') => {
    if (!agent || opening.current) return;
    opening.current = true;
    setBusy(true); setFeedback('');
    try {
      await Linking.openURL(buyerAgentLink(agent, action, property, apple));
      setFeedback(action === 'text' ? 'Complete or cancel the message in your messaging app.' : 'Complete or cancel the call in your phone app.');
    } catch {
      setFeedback(`Could not open a ${action === 'text' ? 'messaging' : 'phone'} app. You can contact your agent at ${agent.phone}.`);
    } finally { opening.current = false; setBusy(false); }
  };
  return <View style={styles.specificationsSection}>
    <Text accessibilityRole="header" style={styles.specificationsTitle}>Your own agent</Text>
    <Text style={styles.description}>Use a number you know belongs to your agent. Kept only for this app session; restarting the app clears it. No contacts permission is needed.</Text>
    {editing ? <View style={{ gap: 8, marginTop: 12 }}>
      <TextInput accessibilityLabel="Your agent name (optional)" placeholder="Agent name (optional)" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={80} style={styles.searchInput} />
      <TextInput accessibilityLabel="Your agent US or Canada phone number" placeholder="US or Canada phone number" placeholderTextColor={colors.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="off" maxLength={30} style={styles.searchInput} />
      <Pressable accessibilityRole="button" onPress={save} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Use this agent</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setEditing(false); setFeedback(''); }} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Cancel agent edit</Text></Pressable>
    </View> : agent ? <View>
      <Text style={styles.description}>{agent.name || 'Your agent'} · {agent.phone}</Text>
      <Text style={styles.description}>These actions open your phone or message composer. Messages are not sent automatically.</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void open('call')} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Call your agent</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void open('text')} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Text your agent about this property</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={edit} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Edit your agent</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { onChange(null); setName(''); setPhone(''); setFeedback('Agent cleared.'); }} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Clear your agent</Text></Pressable>
    </View> : <Pressable accessibilityRole="button" onPress={edit} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Add your agent for this session</Text></Pressable>}
    {feedback ? <Text accessibilityLiveRegion="polite" style={styles.noteText}>{feedback}</Text> : null}
  </View>;
}
