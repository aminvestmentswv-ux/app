import XCTest

final class AMNativeUITests: XCTestCase {
    var app = XCUIApplication(bundleIdentifier: "com.aminvestments.nativeqatest")
    override func setUpWithError() throws { continueAfterFailure = false }
    func element(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }
    func contains(_ text: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }
    func capture(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }
    func scrollViewport(_ scroll: XCUIElement, upward: Bool) {
        // UI keyboard containers can themselves be ScrollViews. Use the exact
        // app viewport and keep every gesture above an onscreen keyboard.
        let frame = scroll.frame.intersection(app.frame)
        let keyboard = app.keyboards.firstMatch
        let bottom = keyboard.exists ? min(frame.maxY, keyboard.frame.minY) : frame.maxY
        let top = frame.minY + 12
        let height = bottom - 12 - top
        XCTAssertGreaterThan(height, 80, "Expected an unobscured app scroll viewport")
        guard height > 80 else { return }
        let origin = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
        let x = frame.midX - app.frame.minX
        let high = top + height * 0.22 - app.frame.minY
        let low = top + height * 0.78 - app.frame.minY
        let start = origin.withOffset(CGVector(dx: x, dy: upward ? low : high))
        let end = origin.withOffset(CGVector(dx: x, dy: upward ? high : low))
        start.press(forDuration: 0.05, thenDragTo: end)
    }
    func reveal(_ target: XCUIElement, detail: Bool = false) {
        let scroll = app.scrollViews[detail ? "property-details-scroll" : "property-inventory-scroll"]
        XCTAssertTrue(scroll.waitForExistence(timeout: 5), "Expected the identified app scroll view")
        guard scroll.exists else { return }
        for _ in 0..<12 {
            if target.exists && target.isHittable { return }
            scrollViewport(scroll, upward: true)
        }
        // Search backwards too: previous actions may have left this scroll at the bottom.
        for _ in 0..<14 {
            if target.exists && target.isHittable { return }
            scrollViewport(scroll, upward: false)
        }
        capture("failure-unrevealed-element")
        print("CURRENT_APP_UI_AT_REVEAL_FAILURE: " + String(app.debugDescription.prefix(16000)))
        XCTFail("Unable to reveal element: \(target)")
    }
    func tap(_ label: String, detail: Bool = false) {
        let target = element(label); reveal(target, detail: detail); target.tap()
    }
    func attemptCount() -> Int {
        let status = contains("QA inventory attempts: ")
        XCTAssertTrue(status.waitForExistence(timeout: 5))
        return Int(status.label.components(separatedBy: ": ").last ?? "") ?? -100
    }
    func waitForAttempt(after previous: Int) {
        let predicate = NSPredicate { _, _ in self.attemptCount() > previous }
        let expected = XCTNSPredicateExpectation(predicate: predicate, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [expected], timeout: 20), .completed, "A new network refresh must actually start")
    }
    func recordInventoryFailure(_ name: String) {
        capture(name)
        print("CURRENT_APP_UI_AT_INVENTORY_FAILURE: " + String(app.debugDescription.prefix(16000)))
    }
    @discardableResult
    func waitForInventorySettlement() -> Bool {
        let success = contains("Loaded the latest published website inventory.")
        let fallback = contains("Could not get a current update. Showing saved inventory; availability may have changed.")
        let predicate = NSPredicate { _, _ in
            (success.exists || fallback.exists) && self.element("Refresh property inventory").isEnabled
        }
        let settled = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: predicate, object: nil)], timeout: 30) == .completed
        if !settled { recordInventoryFailure("failure-unsettled-inventory") }
        XCTAssertTrue(settled, "Initial request must settle to explicit success or saved-data fallback")
        return success.exists
    }
    func requireInitialLiveInventory() {
        if waitForInventorySettlement() { return }
        // Retry only an explicit, settled fallback. Never hide a pending request.
        reveal(contains("Could not get a current update."))
        capture("initial-live-fallback-before-manual-retry")
        let previous = attemptCount()
        tap("Refresh property inventory")
        waitForAttempt(after: previous)
        let refreshed = contains("Loaded the latest published website inventory.").waitForExistence(timeout: 30)
        if !refreshed { recordInventoryFailure("failure-live-inventory-after-manual-retry") }
        XCTAssertTrue(refreshed, "Real live inventory must load initially or after one explicit manual retry")
    }
    func relaunchAndOpenContactProperty() {
        app.terminate()
        app = XCUIApplication(bundleIdentifier: "com.aminvestments.nativeqatest")
        app.launch()
        XCTAssertTrue(element("Search properties by address or city").waitForExistence(timeout: 30))
        let live = waitForInventorySettlement()
        print("CONTACT_TEST_INVENTORY: " + (live ? "live" : "saved-data fallback"))
        tap("Available")
        // Contact persistence must also work offline. Separate acceptance below
        // still requires a successful real HTTPS inventory refresh.
        // Search is exercised in testInstalledNativeAcceptance. Open the known
        // card directly so keyboard startup cannot mask contact persistence.
        tap("View \(qaAddress)")
        XCTAssertTrue(element("Close property details").waitForExistence(timeout: 10))
    }
    func enterContactText(_ label: String, value: String, focus: Bool = true) {
        let field = element(label)
        reveal(field, detail: true)
        if focus { field.tap() }
        // Pace synthesized input through the native controlled TextInput and
        // assert the exact entered value before attempting persistence.
        for character in value { app.typeText(String(character)) }
        XCTAssertEqual(field.value as? String, value)
    }
    func testBuyerAgentPersistence() {
        // Disposable test identity and reserved example number; never tap call/text.
        relaunchAndOpenContactProperty()
        if element("Clear your agent").exists {
            // Only the reserved synthetic contact may be reset on this QA identity.
            let synthetic = element("Test agent · +13045550123")
            reveal(synthetic, detail: true); XCTAssertTrue(synthetic.exists)
            tap("Clear your agent", detail: true)
        }
        let add = element("Add your agent")
        reveal(add, detail: true); XCTAssertTrue(add.exists)
        tap("Add your agent", detail: true)
        enterContactText("Your agent name (optional)", value: "Test agent")
        capture("contact-name-entered")
        element("Your agent name (optional)").typeText("\n")
        enterContactText("Your agent US or Canada phone number", value: "3045550123", focus: false)
        capture("contact-phone-entered")
        let done = app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 5), "Phone keyboard must provide native Done control")
        done.tap()
        let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.keyboards.firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for: [dismissed], timeout: 5), .completed)
        XCTAssertTrue(element("Save agent on this device").exists)
        XCTAssertFalse(element("Test agent · +13045550123").exists, "Done must not save without the explicit Save action")
        tap("Save agent on this device", detail: true)
        let saved = element("Test agent · +13045550123")
        reveal(saved, detail: true); XCTAssertTrue(saved.exists)
        capture("contact-saved")
        relaunchAndOpenContactProperty()
        let restored = element("Test agent · +13045550123")
        reveal(restored, detail: true); XCTAssertTrue(restored.exists)
        capture("contact-restored-after-cold-restart")
        tap("Clear your agent", detail: true)
        reveal(element("Add your agent"), detail: true)
        XCTAssertTrue(element("Add your agent").exists)
        relaunchAndOpenContactProperty()
        reveal(element("Add your agent"), detail: true)
        XCTAssertTrue(element("Add your agent").exists)
        XCTAssertFalse(element("Call your agent").exists)
        capture("contact-clear-survives-cold-restart")
    }
    func testInstalledNativeAcceptance() throws {
        app.launch()
        XCTAssertTrue(element("Search properties by address or city").waitForExistence(timeout: 30), "Installed release app must launch without Metro")
        capture("01-cold-launch-safe-area")
        let feedback = contains("Loaded the latest published website inventory.")
        requireInitialLiveInventory()
        reveal(feedback)
        capture("02-live-refresh")
        tap("QA set inventory offline")
        XCTAssertTrue(element("QA inventory connection: offline").waitForExistence(timeout: 5))
        var attempts = attemptCount()
        tap("Refresh property inventory")
        waitForAttempt(after: attempts)
        XCTAssertTrue(contains("Could not get a current update.").waitForExistence(timeout: 15))
        capture("03-simulated-offline-fallback")
        // A saved listing must still be accessible after the failed update.
        let savedListing = element("View \(qaAddress)")
        reveal(savedListing); XCTAssertTrue(savedListing.exists)
        tap("QA set inventory online")
        attempts = attemptCount()
        tap("Refresh property inventory")
        waitForAttempt(after: attempts)
        XCTAssertTrue(feedback.waitForExistence(timeout: 30), "Real HTTPS retry after injected failure")
        capture("04-offline-recovery")
        for label in ["Available", "Coming Soon", "Under Contract", "Sold"] {
            tap(label)
            let heading = element("\(label) properties")
            reveal(heading)
            XCTAssertTrue(heading.exists)
            capture("status-\(label)")
        }
        tap("Available")
        let search = app.textFields.matching(NSPredicate(format: "label == %@", "Search properties by address or city")).firstMatch
        reveal(search); search.tap(); search.typeText("zzzznativeqanoresult")
        // Return hides keyboard without injecting a platform-specific Back action.
        search.typeText("\n")
        let empty = app.staticTexts["No matching properties"]; reveal(empty); XCTAssertTrue(empty.exists)
        tap("Clear search")
        reveal(search); search.tap(); search.typeText(qaAddress); search.typeText("\n")
        let listing = element("View \(qaAddress)"); reveal(listing); XCTAssertTrue(listing.exists)
        listing.tap()
        XCTAssertTrue(element("Close property details").waitForExistence(timeout: 10))
        capture("04-details-safe-area")
        for field in ["Bedrooms", "Bathrooms", "Square footage", "Description"] {
            let target = contains(field); reveal(target, detail: true); XCTAssertTrue(target.exists)
        }
        let firstCounter = element("Photo 1 of \(qaPhotoCount)")
        reveal(firstCounter, detail: true); XCTAssertTrue(firstCounter.exists)
        tap("Next photo", detail: true)
        XCTAssertTrue(element("Photo 2 of \(qaPhotoCount)").waitForExistence(timeout: 5))
        capture("05-gallery-next")
        tap("Previous photo", detail: true)
        XCTAssertTrue(firstCounter.waitForExistence(timeout: 5))
        tap("Previous photo", detail: true)
        XCTAssertTrue(element("Photo \(qaPhotoCount) of \(qaPhotoCount)").waitForExistence(timeout: 5))
        tap("Close property details", detail: true)
        XCTAssertTrue(listing.waitForExistence(timeout: 5)); reveal(listing); listing.tap()
        XCTAssertTrue(element("Close property details").waitForExistence(timeout: 5))
        tap("Close property details", detail: true)
        tap("Clear search")
        attempts = attemptCount()
        tap("Refresh property inventory")
        waitForAttempt(after: attempts)
        XCTAssertTrue(contains("Loaded the latest published website inventory.").waitForExistence(timeout: 30))
        attempts = attemptCount()
        XCUIDevice.shared.press(.home)
        sleep(2)
        app.activate()
        waitForAttempt(after: attempts)
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        reveal(contains("Loaded the latest published website inventory."))
        XCTAssertTrue(contains("Loaded the latest published website inventory.").waitForExistence(timeout: 30))
        capture("06-foreground-refresh")
        app.terminate()
        // Queries resolved before termination can retain the old process's
        // accessibility tree. Use a fresh app and fresh queries for this process.
        app = XCUIApplication(bundleIdentifier: "com.aminvestments.nativeqatest")
        app.launch()
        let relaunchedSearch = element("Search properties by address or city")
        XCTAssertTrue(relaunchedSearch.waitForExistence(timeout: 30))
        let relaunchedFeedback = contains("Loaded the latest published website inventory.")
        let didRefreshAfterRelaunch = relaunchedFeedback.waitForExistence(timeout: 30)
        if !didRefreshAfterRelaunch {
            capture("failure-cold-relaunch-refresh")
            print("CURRENT_APP_UI_AT_RELAUNCH_FAILURE: " + String(app.debugDescription.prefix(16000)))
        }
        XCTAssertTrue(didRefreshAfterRelaunch, "Cold relaunch must fetch the live inventory in the new process")
        reveal(relaunchedFeedback)
        capture("07-cold-relaunch")
    }
}
