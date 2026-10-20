import { useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { propertySnapshot } from './catalog';
import { COMPANY_PHONE, STATUS_LABELS, canCallAboutProperty, canInquireAboutPurchase, type PropertyStatus, type SaleProperty } from './properties';
import { styles } from './styles';
import { ShareButton } from './ShareButton';
import { PropertyLocation } from './PropertyLocation';

const priceFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const companyLogo = require('../assets/am-investments-logo-house.png');

export function BrandLogo({ compact = false, wide = false }: { compact?: boolean; wide?: boolean }) {
  return (
    <View style={[styles.logoFrame, compact && styles.compactLogoFrame, wide && styles.wideLogoFrame]}>
      <Image accessibilityRole="image" accessibilityLabel="AM Investments logo" source={companyLogo} resizeMode="contain" style={wide ? styles.wideBrandLogo : compact ? styles.compactLogo : styles.brandLogo} />
      {wide ? <Text style={styles.logoWordmark}>AM INVESTMENTS</Text> : null}
    </View>
  );
}

export const checkedDate = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
}).format(new Date(propertySnapshot.checkedAt));

export async function openLink(url: string) {
  const isCompanyPhone = url === `tel:${COMPANY_PHONE}`;
  let isCompanyWebsite = false;
  try {
    const parsed = new URL(url);
    isCompanyWebsite = parsed.protocol === 'https:' && !parsed.username && !parsed.password && parsed.hostname === 'www.aminvestmentswv.com';
  } catch { /* Reject unrecognized links before opening them. */ }
  if (!isCompanyPhone && !isCompanyWebsite) return;
  try { await Linking.openURL(url); }
  catch { Alert.alert('Unable to open this link', 'Visit www.aminvestmentswv.com or call (304) 250-9336.'); }
}

function PropertyPhoto({ uri, alt, large = false }: { uri?: string; alt: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return (
    <View accessibilityLabel={`Photo unavailable for ${alt}`} style={[styles.photo, large && styles.largePhoto, styles.photoFallback]}>
      <View style={styles.photoLogo}><BrandLogo compact /></View>
      <Text style={styles.photoFallbackText}>Photo unavailable</Text>
      <Text style={styles.photoFallbackHint}>View the original listing for more photos</Text>
    </View>
  );
  return <Image accessibilityLabel={alt} source={{ uri }} onError={() => setFailed(true)} resizeMode="cover" style={[styles.photo, large && styles.largePhoto]} />;
}

function StatusPill({ status }: { status: PropertyStatus }) {
  return <View style={[styles.statusPill, status !== 'available' && styles.mutedPill]}><Text style={styles.statusPillText}>{STATUS_LABELS[status]}</Text></View>;
}

function PropertyFacts({ property }: { property: SaleProperty }) {
  const facts = [
    property.bedrooms !== undefined ? `${property.bedrooms} beds` : null,
    property.bathrooms !== undefined ? `${property.bathrooms} baths` : null,
    property.squareFeet !== undefined ? `${property.squareFeet.toLocaleString('en-US')} sq ft` : null,
  ].filter(Boolean);
  return facts.length ? <Text style={styles.features}>{facts.join('   ·   ')}</Text> : null;
}

function PropertySpecifications({ property }: { property: SaleProperty }) {
  const facts = [
    ['Bedrooms', property.bedrooms?.toLocaleString('en-US')],
    ['Bathrooms', property.bathrooms?.toLocaleString('en-US')],
    ['Square footage', property.squareFeet === undefined ? undefined : `${property.squareFeet.toLocaleString('en-US')} sq ft`],
  ];
  return (
    <View style={styles.specificationsSection}>
      <Text accessibilityRole="header" style={styles.specificationsTitle}>Property details</Text>
      <View style={styles.specificationsList}>
        {facts.map(([label, value]) => (
          <View key={label} style={styles.specificationRow}>
            <Text style={styles.specificationLabel}>{label}</Text>
            <Text style={[styles.specificationValue, value === undefined && styles.specificationMissing]}>{value ?? 'Not published'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function PropertyCard({ property, onOpen }: { property: SaleProperty; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${property.address}`} onPress={onOpen} style={({ pressed }) => [styles.propertyCard, pressed && styles.pressed]}>
      <PropertyPhoto uri={property.imageUrl} alt={property.images?.[0]?.alt || property.address} />
      <View style={styles.propertyBody}>
        <View style={styles.cardTop}><StatusPill status={property.status} /><Text style={styles.saleLabel}>AM INVESTMENTS</Text></View>
        {property.price !== undefined ? <View><Text style={styles.priceLabel}>Listed price</Text><Text style={styles.price}>{priceFormatter.format(property.price)}</Text></View> : <Text style={styles.priceNote}>{property.status === 'available' ? 'Contact for pricing' : 'Price not published'}</Text>}
        <Text accessibilityRole="header" style={styles.address}>{property.address}</Text>
        <Text style={styles.description}>{property.locationIncomplete ? 'Location details on website' : `${property.city}, ${property.state}${property.postalCode ? ` ${property.postalCode}` : ''}`}</Text>
        <PropertyFacts property={property} />
        <View style={styles.cardBottom}><Text style={styles.cardLinkText}>Explore property</Text><Text style={styles.cardArrow}>{'>'}</Text></View>
      </View>
    </Pressable>
  );
}

export function PropertyDetails({ property, onClose, onAvailable }: { property: SaleProperty; onClose: () => void; onAvailable: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const images = property.images || [];
  const image = images[photoIndex];
  const swipeCancelled = useRef(false);
  const swipe = useMemo(() => PanResponder.create({
    // Let vertical gestures continue scrolling the property details.
    onMoveShouldSetPanResponder: (_, gesture) => images.length > 1 &&
      gesture.numberActiveTouches === 1 && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
    onPanResponderGrant: () => { swipeCancelled.current = false; },
    onPanResponderMove: (_, gesture) => { if (gesture.numberActiveTouches > 1) swipeCancelled.current = true; },
    onPanResponderRelease: (_, gesture) => {
      if (!swipeCancelled.current && images.length > 1 && Math.abs(gesture.dx) >= 40 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3) {
        setPhotoIndex((index) => (index + (gesture.dx < 0 ? 1 : -1) + images.length) % images.length);
      }
    },
    onPanResponderTerminationRequest: () => true,
  }), [images.length]);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View role="dialog" accessibilityLabel={`${property.address} property details`} accessibilityViewIsModal style={styles.detailScreen}>
        <View style={styles.detailHeader}>
          <BrandLogo compact />
          <Pressable accessibilityRole="button" accessibilityLabel="Close property details" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>Close  ×</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.detailScroll}>
          <View style={styles.detailContainer}>
            <View accessibilityLabel={`${property.address} photo gallery`} {...swipe.panHandlers} style={{ width: '100%', ...(Platform.OS === 'web' ? { touchAction: 'pan-y pinch-zoom', userSelect: 'none' } : {}) }}>
              <PropertyPhoto key={image?.url || 'no-photo'} uri={image?.url} alt={image?.alt || property.address} large />
            </View>
            {images.length > 1 ? <Text style={styles.swipeHint}>Swipe left or right to browse photos</Text> : null}
            {images.length > 1 ? <View style={styles.galleryControls}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" onPress={() => setPhotoIndex((photoIndex - 1 + images.length) % images.length)} style={styles.galleryButton}><Text style={styles.cardLinkText}>Previous</Text></Pressable>
              <Text accessibilityLiveRegion="polite" style={styles.description}>Photo {photoIndex + 1} of {images.length}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next photo" onPress={() => setPhotoIndex((photoIndex + 1) % images.length)} style={styles.galleryButton}><Text style={styles.cardLinkText}>Next</Text></Pressable>
            </View> : null}
            <View style={styles.detailBody}>
              <StatusPill status={property.status} />
              <Text accessibilityRole="header" style={styles.detailTitle}>{property.address}</Text>
              <Text style={styles.description}>{property.locationIncomplete ? 'The website has not published a complete address for this listing.' : `${property.city}, ${property.state}${property.postalCode ? ` ${property.postalCode}` : ''}`}</Text>
              {property.price !== undefined ? <><Text style={styles.detailPriceLabel}>Listed price</Text><Text style={styles.price}>{priceFormatter.format(property.price)}</Text></> : <Text style={styles.detailPriceLabel}>Pricing is not published. Refer to the source listing for details.</Text>}
              <PropertySpecifications property={property} />
              <ShareButton property={property} />
              <View style={styles.availabilityNote}><Text style={styles.noteText}>{canInquireAboutPurchase(property) ? 'Listed as available when this inventory was checked. Please confirm current pricing and availability with AM Investments.' : property.status === 'coming-soon' ? 'This property is coming soon. Contact AM Investments for updates and timing.' : `${property.status === 'sold' ? 'This property is sold.' : 'This property is under contract.'} It is not listed as available to buy.`}</Text></View>
              <Text accessibilityRole="header" style={styles.aboutTitle}>Description</Text>
              <Text style={styles.detailDescription}>{property.description?.trim() || 'No description has been published on the website yet.'}</Text>
              <PropertyLocation property={property} />
              {canCallAboutProperty(property) ? <Pressable accessibilityRole="link" accessibilityLabel="Call AM Investments about this property" onPress={() => void openLink(`tel:${COMPANY_PHONE}`)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Call about this property</Text><Text style={styles.buttonSubtext}>(304) 250-9336</Text></Pressable> : property.status !== 'available' ? <Pressable accessibilityRole="button" onPress={onAvailable} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Browse available properties</Text></Pressable> : null}
              <Pressable accessibilityRole="link" accessibilityLabel="View original property listing" onPress={() => void openLink(property.detailsUrl!)} style={styles.secondaryButton}><Text style={styles.cardLinkText}>View original listing</Text></Pressable>
              <Text style={styles.detailSource}>Website inventory checked {checkedDate}. This is a saved inventory, not a live availability feed.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
