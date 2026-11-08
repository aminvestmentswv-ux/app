import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { parseBuyerAgent } from '../src/buyerAgent.ts';

// Exercise actual component handlers with a minimal hook/native host. These tests
// do not simulate UIKit keyboard geometry; that remains a native acceptance gate.
const source = readFileSync(new URL('../src/BuyerAgentContact.tsx', import.meta.url), 'utf8');
function setup(os = 'ios') {
  let cursor = 0, dismissals = 0;
  const slots = [], updates = [];
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
  };
  const jsx = (type, props) => ({ type, props });
  const native = { Platform: { OS: os }, Keyboard: { dismiss() { dismissals++; } }, Linking: {},
    Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View' };
  const dependencies = { react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    './buyerAgent': { parseBuyerAgent }, './styles': { colors: {}, styles: {} } };
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  runInNewContext(compiled, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  const contact = { agent: null, ready: true, saving: false, update: async value => { updates.push(value); return true; } };
  let nodes = [];
  function render() {
    cursor = 0; nodes = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      nodes.push(node); visit(node.props.children);
    }
    visit(exports.BuyerAgentContact({ property: {}, contact }));
  }
  const button = label => nodes.find(node => node.type === 'Pressable' && node.props.children?.props?.children === label).props;
  const input = label => nodes.find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label).props;
  render(); button('Add your agent').onPress(); render();
  return { render, button, input, contact, updates, dismissals: () => dismissals };
}
const nameLabel = 'Your agent name (optional)', phoneLabel = 'Your agent US or Canada phone number';

for (const platform of ['ios', 'android', 'web']) {
  test(`${platform}: Next focuses phone; Done dismisses without saving`, () => {
    const app = setup(platform), name = app.input(nameLabel), phone = app.input(phoneLabel);
    let focused = 0;
    phone.ref.current = { focus() { focused++; } };
    assert.equal(name.returnKeyType, 'next');
    assert.equal(name.submitBehavior, 'submit');
    name.onSubmitEditing(); assert.equal(focused, 1);
    assert.equal(phone.keyboardType, 'phone-pad');
    assert.equal(phone.returnKeyType, 'done');
    assert.equal(phone.submitBehavior, 'blurAndSubmit');
    phone.onSubmitEditing();
    assert.equal(app.dismissals(), 1); assert.equal(app.updates.length, 0);
  });
}

test('save dismisses keyboard, preserves validation and writes only on explicit Save', async () => {
  const app = setup();
  app.input(nameLabel).onChangeText('Test agent');
  app.input(phoneLabel).onChangeText('bad'); app.render();
  app.button('Save agent on this device').onPress();
  assert.equal(app.updates.length, 0); assert.equal(app.dismissals(), 0);
  app.input(phoneLabel).onChangeText('3045550123'); app.render();
  app.button('Save agent on this device').onPress();
  await new Promise(resolve => setImmediate(resolve)); app.render();
  assert.deepEqual(app.updates, [{ name: 'Test agent', phone: '+13045550123' }]);
  assert.equal(app.dismissals(), 1);
  assert.ok(app.button('Add your agent'));
});

test('cancel dismisses and discards draft, and repeated editing starts clean', () => {
  const app = setup();
  app.input(phoneLabel).onChangeText('3045550123');
  app.button('Cancel agent edit').onPress(); app.render();
  assert.equal(app.dismissals(), 1); assert.equal(app.updates.length, 0);
  app.button('Add your agent').onPress(); app.render();
  assert.equal(app.input(phoneLabel).value, '');
});

test('details opt into iOS keyboard insets and drag dismissal without double padding', () => {
  const details = readFileSync(new URL('../src/components.tsx', import.meta.url), 'utf8');
  const scroll = details.match(/<ScrollView\s+testID="property-details-scroll"[^>]+>/)?.[0];
  assert.ok(scroll);
  assert.match(scroll, /automaticallyAdjustKeyboardInsets=\{Platform.OS === 'ios'\}/);
  assert.match(scroll, /keyboardDismissMode=\{Platform.OS === 'ios' \? 'interactive' : 'none'\}/);
  assert.match(scroll, /keyboardShouldPersistTaps="handled"/);
  assert.doesNotMatch(details, /<KeyboardAvoidingView/);
  assert.match(readFileSync(new URL('../App.tsx', import.meta.url), 'utf8'), /<ScrollView testID="property-inventory-scroll"/);
});
