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
  assert.match(contact, /enterContactText\("Your agent US or Canada phone number", value: "3045550123", focus: false\)/);
  assert.match(contact, /contact-restored-after-cold-restart/);
  assert.match(contact, /contact-clear-survives-cold-restart/);
  assert.doesNotMatch(contact, /tap\("(?:Call|Text) your agent/);
});

test('contact setup selects the known card without duplicating keyboard search and validates input', () => {
  const setup = source.slice(source.indexOf('    func relaunchAndOpenContactProperty()'), source.indexOf('    func enterContactText('));
  assert.match(setup, /waitForInventorySettlement/);
  assert.match(setup, /CONTACT_TEST_INVENTORY/);
  assert.doesNotMatch(setup, /search\.typeText/);
  const input = source.slice(source.indexOf('    func enterContactText('), source.indexOf('    func testBuyerAgentPersistence()'));
  assert.match(input, /for character in value/);
  assert.match(input, /XCTAssertEqual\(field\.value as\? String, value\)/);
});

test('contact fallback is isolated from the mandatory real live-feed gate', () => {
  const settle = source.slice(source.indexOf('    func waitForInventorySettlement()'), source.indexOf('    func requireInitialLiveInventory()'));
  assert.match(settle, /Could not get a current update\. Showing saved inventory/);
  assert.match(settle, /Refresh property inventory"\)\.isEnabled/);
  const gate = source.slice(source.indexOf('    func requireInitialLiveInventory()'), source.indexOf('    func relaunchAndOpenContactProperty()'));
  assert.match(gate, /if waitForInventorySettlement\(\) \{ return \}/);
  assert.equal(gate.match(/tap\("Refresh property inventory"\)/g).length, 1);
  assert.match(gate, /waitForAttempt\(after: previous\)/);
  assert.match(gate, /XCTAssertTrue\(refreshed,/);
  assert.match(gate, /failure-live-inventory-after-manual-retry/);
  assert.match(source.slice(source.indexOf('    func testInstalledNativeAcceptance()')), /requireInitialLiveInventory\(\)/);
});


test('native scrolling targets stable app views and excludes the onscreen keyboard', () => {
  const scroll = source.slice(source.indexOf('    func scrollViewport('), source.indexOf('    func tap('));
  assert.match(scroll, /property-details-scroll/);
  assert.match(scroll, /property-inventory-scroll/);
  assert.match(scroll, /app\.otherElements\[detail/);
  assert.match(scroll, /container\.scrollViews\.firstMatch/);
  assert.match(scroll, /CURRENT_APP_UI_AT_SCROLL_FAILURE/);
  assert.match(scroll, /keyboard\.frame\.minY/);
  assert.match(scroll, /scroll\.frame\.intersection\(app\.frame\)/);
  assert.match(scroll, /thenDragTo: end/);
  assert.doesNotMatch(scroll, /scrollViews\.count|scroll\.swipe(?:Up|Down)/);
  assert.match(source, /capture\("contact-name-entered"\)/);
  assert.match(source, /capture\("contact-phone-entered"\)/);
});


test('contact keyboard coverage exercises Next and native Done before saving', () => {
  const contact = source.slice(source.indexOf('    func testBuyerAgentPersistence()'), source.indexOf('    func testInstalledNativeAcceptance()'));
  assert.match(contact, /element\("Your agent name \(optional\)"\)\.typeText\("\\n"\)/);
  assert.match(contact, /value: "3045550123", focus: false/);
  assert.match(source, /app\.typeText\(String\(character\)\)/);
  assert.match(contact, /let done = app\.buttons\["Done"\]/);
  assert.ok(contact.indexOf('done.tap()') < contact.indexOf('tap("Save agent on this device"'));
  assert.match(contact, /exists == false/);
});


test('search verifies paced exact queries and disambiguates nested Fabric text', () => {
  const search = source.slice(source.indexOf('        let search = app.textFields'), source.indexOf('        let listing = element('));
  assert.match(search, /for character in unmatchedQuery \{ app\.typeText\(String\(character\)\) \}/);
  assert.match(search, /XCTAssertEqual\(search\.value as\? String, unmatchedQuery\)/);
  assert.match(search, /let empty = element\("No matching properties"\)/);
  assert.doesNotMatch(search, /app\.staticTexts\[/);
  assert.match(search, /for character in qaAddress \{ app\.typeText\(String\(character\)\) \}/);
  assert.match(search, /XCTAssertEqual\(search\.value as\? String, qaAddress,/);
  assert.match(search, /capture\("search-no-matching-properties"\)/);
  assert.match(search, /XCTAssertFalse\(element\("Clear search"\)\.exists,/);
  assert.match(search, /clearedValue == "" \|\| clearedValue == "Search by address or city"/);
  assert.equal(search.match(/object: app\.keyboards\.firstMatch/g).length, 2);
  assert.equal(search.match(/search\.typeText\("\\n"\)/g).length, 2);
});
