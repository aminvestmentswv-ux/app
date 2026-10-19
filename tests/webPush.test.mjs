import assert from 'node:assert/strict';
import test from 'node:test';

test('diagnostic opt-out is safe in native-style windows and explicit on web', async () => {
  const original = globalThis.window;
  try {
    const cases = [
      [{}, false],
      [{location: {search: ''}}, false],
      [{location: {search: '?am-push=on'}}, false],
      [{location: {search: '?am-push=off'}}, true],
    ];
    for (const [index, [window, expected]] of cases.entries()) {
      globalThis.window = window;
      const module = await import(`../src/webPush.ts?test=${index}`);
      assert.equal(module.PUSH_PAUSED_FOR_TEST, expected);
      if (expected) await assert.rejects(module.loadWebPush(), /paused for this troubleshooting test/);
    }
  } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
});
