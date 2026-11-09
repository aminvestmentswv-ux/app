// Isolated test entrypoint only. Synthetic contacts; external handoffs are mocked.
import { Linking, ScrollView } from 'react-native';
import { ListingAgentContact } from '../../src/ListingAgentContact';
import type { SaleProperty } from '../../src/properties';
const control = globalThis as typeof globalThis & { __contactAttempts: string[]; __failContact: boolean };
control.__contactAttempts = [];
control.__failContact = false;
Linking.openURL = async (url: string) => {
  if (!/^(tel|sms):\+13045550123(?:$|[?&]body=)/.test(url)) throw new Error('Unexpected test recipient');
  control.__contactAttempts.push(url);
  await new Promise(resolve => setTimeout(resolve, 100));
  if (control.__failContact) throw new Error('Synthetic handoff failure');
};
const scenario = new URL(window.location.href).searchParams.get('scenario');
const text = scenario === 'text';
const attribution = text
  ? 'Call/text Example Agent today at 304-555-0123 for details. Property marketed by Example Agent of Example Realty'
  : 'For more information or showings, please contact Example Agent, Realtor, 304-555-0123';
const property: SaleProperty = {
  id: 'synthetic-contact-fixture', listingType: 'sale', status: text ? 'sold' : 'under-contract',
  address: '1 Synthetic Street', city: 'Charleston', state: 'WV',
  detailsUrl: 'https://www.aminvestmentswv.com/property/synthetic-contact-fixture/', description: attribution,
};
if (scenario !== 'missing') property.listingAgent = {
  name: 'Example Agent', phone: '+13045550123', sourceUrl: property.detailsUrl!, attribution,
  ...(text ? {textEvidence: 'Call/text Example Agent today at 304-555-0123'} : {}),
};
export default function App() { return <ScrollView><ListingAgentContact property={property} /></ScrollView>; }
