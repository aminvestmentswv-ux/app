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
    func reveal(_ target: XCUIElement, detail: Bool = false) {
        XCTAssertGreaterThan(app.scrollViews.count, 0, "Expected a native scroll view")
        guard app.scrollViews.count > 0 else { return }
        let scroll = detail ? app.scrollViews.element(boundBy: app.scrollViews.count - 1) : app.scrollViews.firstMatch
        for _ in 0..<12 {
            if target.exists && target.isHittable { return }
            scroll.swipeUp()
        }
        // Search backwards too: previous actions may have left this scroll at the bottom.
        for _ in 0..<14 {
            if target.exists && target.isHittable { return }
            scroll.swipeDown()
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
    func relaunchAndOpenContactProperty() {
        app.terminate()
        app = XCUIApplication(bundleIdentifier: "com.aminvestments.nativeqatest")
        app.launch()
        XCTAssertTrue(element("Search properties by address or city").waitForExistence(timeout: 30))
        XCTAssertTrue(contains("Loaded the latest published website inventory.").waitForExistence(timeout: 30))
        tap("Available")
        // Search is exercised in testInstalledNativeAcceptance. Open the known
        // card directly so keyboard startup cannot mask contact persistence.
        tap("View \(qaAddress)")
        XCTAssertTrue(element("Close property details").waitForExistence(timeout: 10))
    }
    func enterContactText(_ label: String, value: String) {
        let field = element(label)
        reveal(field, detail: true); field.tap()
        // Pace synthesized input through the native controlled TextInput and
        // assert the exact entered value before attempting persistence.
        for character in value { field.typeText(String(character)) }
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
        enterContactText("Your agent US or Canada phone number", value: "3045550123")
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
        XCTAssertTrue(feedback.waitForExistence(timeout: 30), "Initial live refresh")
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
        let search = element("Search properties by address or city")
        reveal(search); search.tap(); search.typeText("zzzznativeqanoresult")
        // Return hides keyboard without injecting a platform-specific Back action.
        search.typeText("\n")
        let empty = element("No matching properties"); reveal(empty); XCTAssertTrue(empty.exists)
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
