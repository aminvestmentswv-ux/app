import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBuyerAgent, buyerAgentLink } from '../src/buyerAgent.ts';
const property = { id: 'home & one', address: '1 Example Street', city: 'Charleston', state: 'WV', status: 'sold' };
test('manual agent numbers normalize without claiming ownership or SMS support', () => {
  assert.deepEqual(parseBuyerAgent(' Agent ', '(304) 555-0123'), { name: 'Agent', phone: '+13045550123' });
  assert.equal(parseBuyerAgent('', '+1 304 555 0123').phone, '+13045550123');
});
test('agent numbers reject URI injection, extensions and invalid country or NANP syntax', () => {
  for (const phone of ['', 'tel:+13045550123', '++13045550123', '304+5550123', '+13045550123?body=hello', '+44 20 7946 0958', '3045550123x12', '1045550123', '3041550123', '30455501234']) assert.throws(() => parseBuyerAgent('', phone));
  assert.throws(() => parseBuyerAgent('a\nname', '3045550123'));
  assert.throws(() => parseBuyerAgent('a'.repeat(81), '3045550123'));
});
test('call and text use validated recipient and encoded property link, never send automatically', () => {
  const agent = parseBuyerAgent('Agent', '3045550123');
  assert.equal(buyerAgentLink(agent, 'call', property), 'tel:+13045550123');
  for (const apple of [false, true]) {
    const link = buyerAgentLink(agent, 'text', property, apple);
    assert.ok(link.startsWith(`sms:+13045550123${apple ? '&' : '?'}body=`));
    const body = decodeURIComponent(link.split('body=')[1]);
    assert.match(body, /1 Example Street/);
    assert.match(body, /property=home\+%26\+one/);
    assert.doesNotMatch(body, /available to buy|for sale/i);
  }
  assert.throws(() => buyerAgentLink({name:'',phone:'123;456'}, 'text', property));
});
