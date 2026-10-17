import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { saleProperties } from './src/catalog';
import { PropertyCard, PropertyDetails, checkedDate, openLink } from './src/components';
import { styles } from './src/styles';
import { COMPANY_WEBSITE, PROPERTY_STATUSES, STATUS_LABELS, propertiesForStatus, searchProperties, type PropertyStatus, type SaleProperty } from './src/properties';

const sectionCopy: Record<PropertyStatus, string> = {
  available: 'Find a place for your next chapter.',
  'under-contract': 'Properties with an accepted offer.',
  sold: 'Explore properties from our sold collection.',
};

export default function App() {
  const [status, setStatus] = useState<PropertyStatus>('available');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<SaleProperty | null>(null);
  const counts = useMemo(() => Object.fromEntries(PROPERTY_STATUSES.map((s) => [s, propertiesForStatus(saleProperties, s).length])) as Record<PropertyStatus, number>, []);
  const properties = useMemo(() => searchProperties(propertiesForStatus(saleProperties, status), query), [status, query]);
  const chooseStatus = (value: PropertyStatus) => { setStatus(value); setLimit(12); };
  const clearSearch = () => { setQuery(''); setLimit(12); };

  return (
    <View style={styles.screen}>
      <StatusBar style={selected ? 'dark' : 'light'} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.brand}><View style={styles.monogram}><Text style={styles.monogramText}>AM</Text></View><View><Text style={styles.brandName}>AM INVESTMENTS</Text><Text style={styles.brandLocation}>WEST VIRGINIA</Text></View></View>
              <View style={styles.saleBadge}><Text style={styles.saleBadgeText}>FOR SALE</Text></View>
            </View>
            <View style={styles.heroContent}>
              <Text accessibilityRole="header" style={styles.heroTitle}>Your next chapter{`\n`}starts here.</Text>
            </View>
          </View>
        </View>
        <View style={[styles.container, styles.main]}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Find your opportunity</Text>
          <Text style={styles.description}>Properties for sale, from first look to sold.</Text>
          <View style={styles.searchBox}>
            <TextInput accessibilityLabel="Search properties by address or city" placeholder="Search by address or city" placeholderTextColor="#647068" value={query} onChangeText={(value) => { setQuery(value); setLimit(12); }} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
            {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={clearSearch} style={styles.clearSearch}><Text style={styles.closeText}>×</Text></Pressable> : <Text accessible={false} style={styles.searchSymbol}>⌕</Text>}
          </View>
          <View accessibilityRole="tablist" accessibilityLabel="Property sale status" style={styles.tabs}>
            {PROPERTY_STATUSES.map((value) => (
              <Pressable key={value} accessibilityRole="tab" accessibilityLabel={STATUS_LABELS[value]} accessibilityState={{ selected: status === value }} aria-selected={status === value} onPress={() => chooseStatus(value)} style={({ pressed }) => [styles.tab, status === value && styles.activeTab, pressed && styles.pressed]}>
                <Text style={[styles.tabText, status === value && styles.activeTabText]}>{STATUS_LABELS[value]}</Text>
                <Text style={[styles.tabCount, status === value && styles.activeTabCount]}>{counts[value]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.snapshotNote}><Text style={styles.snapshotDot}>●</Text><Text style={styles.snapshotText}>Website inventory · {checkedDate}{'\n'}Availability can change. Confirm details with AM Investments.</Text></View>
          <View accessibilityLiveRegion="polite" style={styles.collectionHeader}>
            <Text accessibilityRole="header" style={styles.collectionTitle}>{STATUS_LABELS[status]} properties</Text>
            <Text style={styles.description}>{query ? `${properties.length} matching ${properties.length === 1 ? 'property' : 'properties'}` : sectionCopy[status]}</Text>
          </View>
          {properties.length ? (
            <View>
              {properties.slice(0, limit).map((property) => <PropertyCard key={property.id} property={property} onOpen={() => setSelected(property)} />)}
              {properties.length > limit ? <Pressable accessibilityRole="button" onPress={() => setLimit(limit + 12)} style={styles.loadMore}><Text style={styles.cardLinkText}>Show more properties ({properties.length - limit} remaining)</Text></Pressable> : null}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text accessibilityRole="header" style={styles.emptyTitle}>{query ? 'No matching properties' : `No ${STATUS_LABELS[status].toLowerCase()} listings in this inventory`}</Text>
              <Text style={styles.emptyDescription}>{query ? 'Try another address or city, or clear your search.' : 'Check the website for the latest property updates.'}</Text>
              {query ? <Pressable accessibilityRole="button" onPress={clearSearch} style={styles.secondaryButton}><Text style={styles.cardLinkText}>Clear search</Text></Pressable> : <Pressable accessibilityRole="link" accessibilityLabel="Visit AM Investments website" onPress={() => void openLink(`${COMPANY_WEBSITE}/property/`)} style={styles.secondaryButton}><Text style={styles.cardLinkText}>View properties on our website</Text></Pressable>}
            </View>
          )}
          <View style={styles.footer}>
            <Text style={styles.footerBrand}>Local properties. New possibilities.</Text>
            <Text style={styles.footerDescription}>AM Investments · West Virginia</Text>
            <Pressable accessibilityRole="link" accessibilityLabel="Open official AM Investments website" onPress={() => void openLink(COMPANY_WEBSITE)} style={styles.footerLink}><Text style={styles.cardLinkText}>Our website</Text></Pressable>
          </View>
        </View>
      </ScrollView>
      {selected ? <PropertyDetails key={selected.id} property={selected} onClose={() => setSelected(null)} onAvailable={() => { setSelected(null); clearSearch(); chooseStatus('available'); }} /> : null}
    </View>
  );
}
