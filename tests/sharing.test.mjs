import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_URL, propertyIdFromUrl, shareContent, shareTargets } from '../src/sharing.ts';

const property = { id: '4900-4904-jonquil-drive-charleston-wv', address: '4900 & 4904 Jonquil Drive', city: 'Charleston', state: 'WV', status: 'sold' };

test('app shares use the permanent HTTPS domain without a selected property', () => {
  assert.equal(shareContent().url, APP_URL);
  assert.equal(propertyIdFromUrl(shareContent().url), null);
});

test('property links survive encoding and open the same property without promising availability', () => {
  const content = shareContent(property);
  assert.equal(propertyIdFromUrl(content.url), property.id);
  assert.match(content.text, /4900 & 4904 Jonquil Drive/);
  assert.doesNotMatch(content.text, /available|for sale|\$/i);
  assert.equal(propertyIdFromUrl('invalid URL'), null);
  assert.equal(propertyIdFromUrl(APP_URL + '?property=house%26other%3Dvalue'), 'house&other=value');
});

test('email, SMS and social targets encode the exact property URL as data', () => {
  const content = shareContent(property);
  const targets = shareTargets(content);
  assert.equal(new URL(targets.email).searchParams.get('subject'), content.title);
  assert.equal(new URL(targets.email).searchParams.get('body'), `${content.text}\n${content.url}`);
  assert.equal(new URL(targets.sms).searchParams.get('body'), `${content.text}\n${content.url}`);
  assert.match(shareTargets(content, true).sms, /^sms:&body=/);
  assert.equal(new URL(targets.facebook).searchParams.get('u'), content.url);
  assert.equal(new URL(targets.whatsapp).searchParams.get('text'), `${content.text}\n${content.url}`);
  assert.equal(new URL(targets.x).searchParams.get('url'), content.url);
});
