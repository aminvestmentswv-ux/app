/** Test-build-only instrumentation. Imported only by prepare_native_qa.mjs. */
import { useSyncExternalStore } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

let mode = 'online';
let attempts = 0;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());
const applyUrl = (url: string | null | undefined) => {
  if (url === 'am-native-qa://offline' || url === 'am-native-qa://online') {
    mode = url.endsWith('://offline') ? 'offline' : 'online';
    publish();
  }
};
const initialUrl = Linking.getInitialURL().then(applyUrl);
Linking.addEventListener('url', ({ url }) => applyUrl(url));
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('https://app.aminvestmentswv.com/properties.json?check=')) {
    await initialUrl;
    attempts += 1;
    publish();
    if (mode === 'offline') throw new TypeError('QA-only simulated inventory network failure');
  }
  return realFetch(input, init);
}) as typeof fetch;

export function NativeQaStatus() {
  const current = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, () => `${mode}:${attempts}`);
  const [connection, count] = current.split(':');
  return <View style={{ position: 'absolute', bottom: 30, left: 0, right: 0, backgroundColor: '#fff', padding: 2 }}>
    <Text style={{ fontSize: 10 }}>{`QA inventory connection: ${connection}`}</Text>
    <Text style={{ fontSize: 10 }}>{`QA inventory attempts: ${count}`}</Text>
    <View style={{ flexDirection: 'row' }}>{['offline', 'online'].map((connection) =>
      <Pressable key={connection} accessibilityRole="button" accessibilityLabel={`QA set inventory ${connection}`} onPress={() => applyUrl(`am-native-qa://${connection}`)} style={{ padding: 8 }}>
        <Text>{`QA ${connection}`}</Text>
      </Pressable>)}</View>
  </View>;
}
