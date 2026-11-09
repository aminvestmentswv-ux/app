import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { listingAgentLink, validateListingAgent } from '../src/listingAgent.ts';
import { parseSnapshot } from '../src/properties.ts';
import { publicPropertySnapshot } from '../scripts/export_inventory.mjs';
const source = JSON.parse(readFileSync(new URL('../src/data/properties.json', import.meta.url)));
const quote = 'For more information or showings, please contact Example Agent, Realtor, 304-555-0123';
function property(text = false) {
  const attribution = text ? 'Call/text Example Agent today at 304-555-0123 for details. Property marketed by Example Agent of Example Realty' : quote;
  const p = { ...source.properties[0], status: 'sold', sourceStatus: 'sold', description: attribution };
  delete p.statusOverride;
  p.listingAgent = { name: 'Example Agent', phone: '+13045550123', sourceUrl: p.detailsUrl, attribution, ...(text ? {textEvidence: 'Call/text Example Agent today at 304-555-0123'} : {}) };
  return p;
}
test('existing snapshots stay compatible; contacts require matching public source and attribution', () => {
  assert.ok(parseSnapshot(source));
  const p = property();
  assert.equal(validateListingAgent(p.listingAgent, p).phone, '+13045550123');
  for (const change of [{sourceUrl: 'https://evil.example/'}, {name: 'Other Agent'}, {phone: '+13045550124'}, {attribution: 'Site footer: Example Agent 304-555-0123'}, {phone: '3045550123'}, {textEvidence: 'mobile'}]) {
    assert.throws(() => validateListingAgent({...p.listingAgent, ...change}, p));
  }
  const footer = 'Site footer: Example Agent 304-555-0123';
  assert.throws(() => validateListingAgent({...p.listingAgent, attribution: footer}, {...p, description: footer}));
});
test('phone alone enables calling, never texting; SMS requires exact same-property explicit evidence', () => {
  const p = property();
  assert.equal(listingAgentLink(p, 'call'), 'tel:+13045550123');
  assert.throws(() => listingAgentLink(p, 'text'));
  const sms = property(true);
  for (const apple of [false, true]) {
    const link = listingAgentLink(sms, 'text', apple);
    assert.ok(link.startsWith(`sms:+13045550123${apple ? '&' : '?'}body=`));
    const body = decodeURIComponent(link.split('body=')[1]);
    assert.match(body, /Sold/);
    assert.doesNotMatch(body, /available to buy|for sale/i);
  }
  sms.listingAgent.textEvidence = 'Call/text Another Agent at 304-555-0123';
  assert.throws(() => listingAgentLink(sms, 'text'));
});
test('public feed allowlists listing contact fields and rejects invalid evidence', () => {
  const p = property(true);
  const snapshot = {...source, properties: [p], sourcePropertyCount: 1, excludedNonSaleCount: 0};
  p.listingAgent.privateNotes = 'must not export';
  assert.equal(validateListingAgent(p.listingAgent, p).privateNotes, undefined);
  const exported = publicPropertySnapshot(snapshot);
  assert.equal(exported.properties[0].listingAgent.privateNotes, undefined);
  assert.ok(exported.properties[0].listingAgent.textEvidence);
  p.listingAgent.sourceUrl = 'javascript:alert(1)';
  assert.throws(() => parseSnapshot(snapshot));
});
