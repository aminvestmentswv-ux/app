export const PROPERTY_STATUSES = ['available', 'coming-soon', 'under-contract', 'sold'] as const;

export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  available: 'Available',
  'coming-soon': 'Coming Soon',
  'under-contract': 'Under Contract',
  sold: 'Sold',
};

export type SaleProperty = {
  id: string;
  listingType: 'sale';
  status: PropertyStatus;
  address: string;
  title?: string;
  city: string;
  state: string;
  postalCode?: string;
  locationIncomplete?: boolean;
  description?: string;
  sourceStatus?: string;
  statusOverride?: {
    fromStatus: 'under-contract';
    status: 'available';
    confirmedOn: string;
    reason: string;
  };
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  imageUrl?: string;
  detailsUrl?: string;
  images?: { url: string; alt: string }[];
};

export function propertiesForStatus(
  properties: readonly SaleProperty[],
  status: PropertyStatus,
): SaleProperty[] {
  // Retain the purpose check at runtime so a future feed cannot show rentals.
  return properties.filter(
    (property) => property.listingType === 'sale' && property.status === status,
  );
}

export function canInquireAboutPurchase(property: SaleProperty): boolean {
  return property.listingType === 'sale' && property.status === 'available';
}

export function canCallAboutProperty(property: SaleProperty): boolean {
  return property.listingType === 'sale' && property.status === 'coming-soon';
}

export const COMPANY_WEBSITE = 'https://www.aminvestmentswv.com';
export const COMPANY_PHONE = '+13042509336';

export function searchProperties(properties: readonly SaleProperty[], query: string): SaleProperty[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return properties.filter((property) => {
    const text = `${property.address} ${property.city} ${property.state} ${property.postalCode ?? ''}`.toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}

export type PropertySnapshot = {
  schemaVersion: 1;
  checkedAt: string;
  sourceUrl: string;
  sourcePages: string[];
  sourcePropertyCount: number;
  excludedNonSaleCount: number;
  properties: SaleProperty[];
};

const imageHosts = new Set(['image-cdn.carrot.com', 'cdn.carrot.com', 'www.aminvestmentswv.com']);

function safeUrl(value: unknown, images = false): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (images ? imageHosts.has(url.hostname) : url.hostname === 'www.aminvestmentswv.com' && url.pathname.startsWith('/property/'));
  } catch { return false; }
}

export function parseSnapshot(value: unknown): PropertySnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid property snapshot');
  const snapshot = value as PropertySnapshot;
  if (snapshot.schemaVersion !== 1 || !Number.isFinite(Date.parse(snapshot.checkedAt)) ||
      !safeUrl(snapshot.sourceUrl) || !Array.isArray(snapshot.sourcePages) ||
      !snapshot.sourcePages.every((url) => safeUrl(url)) || !Array.isArray(snapshot.properties) ||
      !Number.isInteger(snapshot.sourcePropertyCount) || !Number.isInteger(snapshot.excludedNonSaleCount) ||
      snapshot.excludedNonSaleCount < 0 || snapshot.sourcePropertyCount !== snapshot.properties.length + snapshot.excludedNonSaleCount) {
    throw new Error('Invalid property snapshot metadata');
  }
  const ids = new Set<string>();
  for (const property of snapshot.properties) {
    if (!property || property.listingType !== 'sale' || !PROPERTY_STATUSES.includes(property.status) ||
        typeof property.id !== 'string' || !property.id || ids.has(property.id) ||
        typeof property.address !== 'string' || !property.address.trim() ||
        typeof property.city !== 'string' || typeof property.state !== 'string' ||
        ((!property.city || !property.state) && property.locationIncomplete !== true) ||
        !safeUrl(property.detailsUrl)) {
      throw new Error('Invalid or duplicate sale property');
    }
    for (const key of ['price', 'bedrooms', 'bathrooms', 'squareFeet'] as const) {
      const number = property[key];
      if (number !== undefined && (typeof number !== 'number' || !Number.isFinite(number) || number < 0)) throw new Error('Invalid property number');
    }
    const sourceStatus = ({ 'for sale': 'available', 'coming soon': 'coming-soon', sold: 'sold', pending: 'under-contract', 'under contract': 'under-contract' } as Record<string, string>)[property.sourceStatus ?? ''];
    const correction = property.statusOverride;
    if (!sourceStatus || (correction ?
        (correction.fromStatus !== 'under-contract' || sourceStatus !== correction.fromStatus ||
         correction.status !== 'available' || property.status !== correction.status ||
         typeof correction.reason !== 'string' || !correction.reason.trim() ||
         typeof correction.confirmedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(correction.confirmedOn) ||
         !Number.isFinite(Date.parse(correction.confirmedOn))) : property.status !== sourceStatus)) {
      throw new Error('Invalid property source status or owner correction');
    }
    if (property.imageUrl !== undefined && !safeUrl(property.imageUrl, true)) throw new Error('Invalid property image URL');
    if (property.images !== undefined && (!Array.isArray(property.images) ||
        !property.images.every((image) => safeUrl(image.url, true) && typeof image.alt === 'string'))) throw new Error('Invalid property images');
    ids.add(property.id);
  }
  return snapshot;
}
