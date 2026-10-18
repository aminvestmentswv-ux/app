import type { SaleProperty } from './properties';

export const APP_URL = 'https://app.aminvestmentswv.com/';
export type ShareContent = { title: string; text: string; url: string };

export function propertyIdFromUrl(url: string): string | null {
  try { return new URL(url).searchParams.get('property'); }
  catch { return null; }
}

export function shareContent(property?: SaleProperty): ShareContent {
  if (!property) return {
    title: 'AM Investments app',
    text: 'Explore AM Investments properties, photos, and details.',
    url: APP_URL,
  };
  const url = new URL(APP_URL);
  url.searchParams.set('property', property.id);
  return {
    title: `${property.address} | AM Investments`,
    // Availability and pricing can change after a link is shared.
    text: `Take a look at ${property.address}${property.city ? ` in ${property.city}, ${property.state}` : ''}. See current photos and details in the AM Investments app.`,
    url: url.href,
  };
}

export function shareTargets(content: ShareContent, apple = false) {
  const message = `${content.text}\n${content.url}`;
  return {
    email: `mailto:?subject=${encodeURIComponent(content.title)}&body=${encodeURIComponent(message)}`,
    sms: `sms:${apple ? '&' : '?'}body=${encodeURIComponent(message)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(content.url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content.text)}&url=${encodeURIComponent(content.url)}`,
  };
}
