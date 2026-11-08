import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Host-side contract checks only. Actual XCTest compilation and execution require
// the hosted macOS runner; these checks do not claim iOS runtime acceptance.
const source = readFileSync(new URL('../scripts/ios-native-tests.swift', import.meta.url), 'utf8');
const relaunch = source.slice(source.lastIndexOf('        app.terminate()'));
test('cold-relaunch test creates new application and queries after terminating old process', () => {
  assert.ok(relaunch.indexOf('app = XCUIApplication(') > relaunch.indexOf('app.terminate()'));
  assert.ok(relaunch.indexOf('app.launch()') > relaunch.indexOf('app = XCUIApplication('));
  assert.ok(relaunch.indexOf('let relaunchedSearch = element(') > relaunch.indexOf('app.launch()'));
  assert.ok(relaunch.indexOf('let relaunchedFeedback = contains(') > relaunch.indexOf('app.launch()'));
  assert.doesNotMatch(relaunch, /\b(?:search|feedback)\.(?:waitForExistence|exists)|reveal\(feedback\)/);
});
test('cold-relaunch still requires exact live-feed success and records current failure evidence', () => {
  assert.match(relaunch, /let relaunchedFeedback = contains\("Loaded the latest published website inventory\."\)/);
  assert.match(relaunch, /XCTAssertTrue\(didRefreshAfterRelaunch,/);
  assert.match(relaunch, /reveal\(relaunchedFeedback\)/);
  assert.match(relaunch, /CURRENT_APP_UI_AT_RELAUNCH_FAILURE/);
  assert.match(source, /CURRENT_APP_UI_AT_REVEAL_FAILURE/);
});

test('agent persistence test uses disposable identity and fresh processes after save and clear', () => {
  const helper = source.slice(source.indexOf('    func relaunchAndOpenContactProperty()'), source.indexOf('    func testBuyerAgentPersistence()'));
  assert.match(helper, /app\.terminate\(\)/);
  assert.match(helper, /XCUIApplication\(bundleIdentifier: "com\.aminvestments\.nativeqatest"\)/);
  const contact = source.slice(source.indexOf('    func testBuyerAgentPersistence()'), source.indexOf('    func testInstalledNativeAcceptance()'));
  assert.equal(contact.match(/relaunchAndOpenContactProperty\(\)/g).length, 3);
  assert.match(contact, /enterContactText\("Your agent US or Canada phone number", value: "3045550123"\)/);
  assert.match(contact, /contact-restored-after-cold-restart/);
  assert.match(contact, /contact-clear-survives-cold-restart/);
  assert.doesNotMatch(contact, /tap\("(?:Call|Text) your agent/);
});

test('contact setup selects the known card without duplicating keyboard search and validates input', () => {
  const setup = source.slice(source.indexOf('    func relaunchAndOpenContactProperty()'), source.indexOf('    func enterContactText('));
  assert.match(setup, /Loaded the latest published website inventory/);
  assert.doesNotMatch(setup, /search\.typeText/);
  const input = source.slice(source.indexOf('    func enterContactText('), source.indexOf('    func testBuyerAgentPersistence()'));
  assert.match(input, /for character in value/);
  assert.match(input, /XCTAssertEqual\(field\.value as\? String, value\)/);
});
