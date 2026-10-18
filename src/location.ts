import type { SaleProperty } from './properties';

export function propertyLocation(property: SaleProperty) {
  if (property.locationIncomplete || !property.address.trim() || !property.city.trim() || !property.state.trim()) return null;
  const address = `${property.address}, ${property.city}, ${property.state}${property.postalCode ? ` ${property.postalCode}` : ''}`;
  return {
    address,
    embedUrl: `https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
  };
}
