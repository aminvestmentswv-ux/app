import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPushPreference, NOTIFICATION_CHOICES, notificationTags, parseNotificationPreference } from '../src/notificationPreferences.ts';

function fakeSDK(subscribed = false, supported = true) {
  const calls = [];
  const sdk = {
    init: async () => {},
    Notifications: { isPushSupported: () => supported },
    User: {
      addTags: (tags) => { calls.push(['tags', tags]); },
      PushSubscription: {
        optedIn: subscribed,
        optIn() { calls.push(['opt-in']); this.optedIn = true; },
        optOut() { calls.push(['opt-out']); this.optedIn = false; },
      },
    },
  };
  return { sdk, calls };
}

test('all four choices are supported; new or invalid settings default to both and explicit none stays none', () => {
  assert.deepEqual(NOTIFICATION_CHOICES.map((choice) => choice.value), ['available', 'coming-soon', 'both', 'none']);
  for (const value of [null, undefined, '', 'unknown']) assert.equal(parseNotificationPreference(value), 'both');
  for (const { value } of NOTIFICATION_CHOICES) assert.equal(parseNotificationPreference(value), value);
});

test('each choice targets only its selected topics, including no topics for none', () => {
  assert.deepEqual(notificationTags('available'), { am_available: '1', am_coming_soon: '0' });
  assert.deepEqual(notificationTags('coming-soon'), { am_available: '0', am_coming_soon: '1' });
  assert.deepEqual(notificationTags('both'), { am_available: '1', am_coming_soon: '1' });
  assert.deepEqual(notificationTags('none'), { am_available: '0', am_coming_soon: '0' });
});

test('loading the default or changing a preference never requests push permission', async () => {
  for (const choice of ['available', 'coming-soon', 'both']) {
    const { sdk, calls } = fakeSDK();
    assert.equal(await applyPushPreference(sdk, choice), false);
    assert.equal(calls.some(([action]) => action === 'opt-in'), false);
  }
});

test('none opts out even when an enable request is passed; enabling requires an explicit supported action', async () => {
  const off = fakeSDK(true);
  assert.equal(await applyPushPreference(off.sdk, 'none', true), false);
  assert.deepEqual(off.calls, [['opt-out'], ['tags', { am_available: '0', am_coming_soon: '0' }]]);
  const on = fakeSDK();
  assert.equal(await applyPushPreference(on.sdk, 'both', true), true);
  assert.equal(on.calls[0][0], 'opt-in');
  const unsupported = fakeSDK(false, false);
  await assert.rejects(applyPushPreference(unsupported.sdk, 'both', true), /not supported/);
  assert.deepEqual(unsupported.calls, []);
});
