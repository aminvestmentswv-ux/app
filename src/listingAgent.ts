import { parseBuyerAgent } from './buyerAgent.ts';
import { STATUS_LABELS, type SaleProperty } from './properties.ts';
import { shareContent } from './sharing.ts';

export type ListingAgent = {
  name: string;
  phone: string;
  sourceUrl: string;
  attribution: string;
  textEvidence?: string;
};

// Evidence is a quote from this property's public description, not a claim
// derived from phone formatting or another property's contact details.
export function validateListingAgent(value: unknown, property: SaleProperty): ListingAgent {
  if (!value || typeof value !== 'object') throw new Error('Invalid listing agent');
  const agent = value as ListingAgent;
  if (typeof agent.name !== 'string' || !agent.name.trim() || typeof agent.phone !== 'string' ||
      typeof agent.attribution !== 'string' || !agent.attribution || agent.attribution.length > 1000 ||
      agent.sourceUrl !== property.detailsUrl || !property.description?.includes(agent.attribution)) throw new Error('Invalid listing agent provenance');
  const parsed = parseBuyerAgent(agent.name, agent.phone);
  if (parsed.name !== agent.name || parsed.phone !== agent.phone ||
      !agent.attribution.includes(agent.name) || !agent.attribution.replace(/\D/g, '').includes(agent.phone.slice(2))) throw new Error('Invalid listing agent attribution');
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const phonePattern = '(?:\\+1[ .-]?)?(?:\\([2-9]\\d{2}\\)|[2-9]\\d{2})[ .-]?[2-9]\\d{2}[ .-]?\\d{4}';
  const modern = new RegExp(`^For more information or showings, please contact ${escape(agent.name)}, (?:Realtor|[A-Za-z &'-]+ Realty), ${phonePattern}$`, 'i');
  const textPattern = new RegExp(`^Call/text ${escape(agent.name)}(?:, REALTOR)?(?: today)? at ${phonePattern}$`);
  const marketed = new RegExp(`Property marketed by ${escape(agent.name)}(?=,| (?:of|sales\\s?person|REALTOR)\\b|$)`);
  if (!modern.test(agent.attribution) && !(agent.textEvidence && marketed.test(agent.attribution))) throw new Error('Missing explicit property agent attribution');
  if (agent.textEvidence !== undefined && (typeof agent.textEvidence !== 'string' ||
      !agent.textEvidence || !agent.attribution.includes(agent.textEvidence) ||
      !textPattern.test(agent.textEvidence) || !agent.textEvidence.includes(agent.name) ||
      !agent.textEvidence.replace(/\D/g, '').includes(agent.phone.slice(2)))) throw new Error('Unverified listing agent texting');
  return { name: agent.name, phone: agent.phone, sourceUrl: agent.sourceUrl, attribution: agent.attribution,
    ...(agent.textEvidence === undefined ? {} : { textEvidence: agent.textEvidence }) };
}

export function listingAgentLink(property: SaleProperty, action: 'call' | 'text', apple = false): string {
  const agent = validateListingAgent(property.listingAgent, property);
  if (action === 'text' && !agent.textEvidence) throw new Error('No verified texting number published');
  if (action === 'call') return `tel:${agent.phone}`;
  const content = shareContent(property);
  const message = `${content.text}\nStatus in saved inventory: ${STATUS_LABELS[property.status]}.\n${content.url}`;
  return `sms:${agent.phone}${apple ? '&' : '?'}body=${encodeURIComponent(message)}`;
}
