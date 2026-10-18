import { createElement } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import type { SaleProperty } from './properties';
import { propertyLocation } from './location';
import { styles } from './styles';

export function PropertyLocation({ property }: { property: SaleProperty }) {
  const location = propertyLocation(property);
  return <View style={styles.locationSection}>
    <Text accessibilityRole="header" style={styles.aboutTitle}>Property location</Text>
    {location ? <>
      <Text style={styles.description}>{location.address}</Text>
      {Platform.OS === 'web' ? <View style={styles.mapFrame}>
        {createElement('iframe', {
          title: `Map of ${location.address}`,
          src: location.embedUrl,
          loading: 'lazy',
          referrerPolicy: 'no-referrer-when-downgrade',
          style: { display: 'block', width: '100%', height: 260, border: 0 },
        })}
      </View> : null}
      <Pressable accessibilityRole="link" accessibilityLabel={`Open map for ${property.address}`} onPress={() => {
        void Linking.openURL(location.mapsUrl).catch(() => Alert.alert('Unable to open the map', 'Try opening this address in your maps app: ' + location.address));
      }} style={styles.secondaryButton}>
        <Text style={styles.cardLinkText}>Open in Google Maps ↗</Text>
      </Pressable>
    </> : <Text style={styles.description}>A complete address is not published for this property. View the original listing for location details.</Text>}
  </View>;
}
