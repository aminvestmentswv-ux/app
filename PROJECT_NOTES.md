# AM Investments Property App — Progress Notes

Standing rules: [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md).
Technical commands: [README.md](README.md).
Saved project: [AM Investments Property App Space](https://chatgpt.com/space/page_6ad5790192448191bd458c0dd106b1aa).

## October 19, 2026 — Approved logo release

- The owner approved the new square AM Investments / EST. 2014 logo without
  an ampersand and authorized publication. Prepare standalone artwork from the
  approved visual mockup, use a proportional 260-pixel homepage logo in a
  full-width white banner, and update compact branding and generated web icons.
- The original website JPEG is retained as provenance. Property data, consent
  controls, custom domain and the existing checked publication workflow remain.
- Publication and installed-device verification must be checked after release.

## October 19, 2026 — Home Screen startup recovery

- The owner confirms properties appear in the working test installation with
  notifications paused, and the same installation goes white with initialization
  enabled. Reproduced the app-side crash with a class-shaped OneSignal SDK:
  `Class constructor OneSignal cannot be invoked without 'new'`.
- OneSignal v16 exports a class. Passing that class directly to React's `setSDK`
  made React invoke it as a state updater, clearing the rendered app. Store it with
  `setSDK(() => instance)` instead. The new browser regression checks initialization,
  no automatic opt-in, explicit Enable, and None/opt-out using that actual SDK
  shape; it is included in the configured custom-domain publication checks.
  An installed-iPhone retest and an actual delivered notification remain pending.

- The owner confirms the separate blue-and-gold Home Screen test displays on the
  iPhone. This establishes basic standalone document display on the domain, not
  that React or OneSignal is the cause of the original blank screen.
- Add an in-scope property-app comparison at `/home-screen-check/app.html` so the
  working test installation can run the same exported app without another install.
  `?am-push=off` skips SDK initialization and subscription/preference updates; the
  test clearly labels alerts paused and hides preference/enable controls. A second
  test link runs the same app with the usual notification initialization. The
  ordinary property-app URL and default consent flow are unchanged. A configured
  web build and five browser startup scenarios passed, including a paused test
  with zero OneSignal requests. Updated export/publication tests also passed.

- Follow-up: the owner still sees a completely white installed-app screen after
  the published recovery update, another install and a full phone restart; Safari
  continues to load. The earlier update did not resolve the reported issue.
- Add `/home-screen-check/`, a separate blue-and-gold standalone test with its own
  manifest identity and no JavaScript, React or push SDK. It isolates basic Home
  Screen document display from the property-app runtime. Device result is pending.
- Add a post-publication HTTPS check that compares served HTML, JavaScript,
  manifest and test-page bytes against the export using both Safari and standalone
  iPhone user agents. A matching response does not establish actual iOS rendering.

- The owner created OneSignal and added the repository configuration. Workflow
  39260891836 embedded the public App ID and initialized the notification baseline
  without sending existing inventory. Actual device delivery is still unverified.
- The owner reports a white screen in the installed iPhone app while Safari loads;
  closing/reopening and reinstalling the original Home Screen app did not resolve it.
  The published bundle rendered in a Chromium mobile check. Exact iPhone cause is
  unconfirmed; a WebKit browser download was blocked by the managed network.
- Add a static startup screen that remains until React mounts, with visible
  recovery codes for failed bundle downloads, startup exceptions and timeouts.
  Reload requests fresh HTML while preserving property links. New Home Screen
  installs launch with a dedicated query URL, retaining the existing manifest ID.
- Retain the previous build's immutable assets during publication, so cached HTML
  can still load across an hourly update. The current-build asset manifest bounds
  retention rather than accumulating all historical exports.
- Type checking, four Node test files, 32 Python tests, a configured web build and
  browser startup checks passed. Normal, missing, broken and stalled bundle cases
  were exercised. Existing browsing checks also passed at 320, 390, 768 and 1280
  pixels with the startup screen enabled. iPhone verification and real push delivery remain pending.

## Verified progress through October 18, 2026 (America/New_York)

- Public web app: https://app.aminvestmentswv.com/.
- Source: https://github.com/aminvestmentswv-ux/app.
- The property website supplies the app. The dedicated Coming Soon page's six
  properties and five matching photos were publicly verified. This is a dated
  observation, not a permanent roster.
- Every property detail page now has Bedrooms, Bathrooms, Square footage and
  Description. Live reads verified Millstone's 4 bedrooms, 3 bathrooms and 2,432
  sq ft, and Hanna Drive's explicit Not published states.
- Recent product source commit: 2c6fa072b04b4355d25e204f1079561c74629d5a.
  Its successful workflow published Pages commit
  375f4411fb7b3719349dbeeda93ca71038fe3ca2. Inspect current main and deployment
  before future work; these are historical references.
- The existing hourly/source-push workflow collects website inventory, validates
  data and code, builds for the active custom domain, checks active-property
  photos, and publishes only after successful checks.
- Cove Way's raw image returned HTTP 413. Responsive Carrot delivery of the same
  original photo resolved it. All 48 active-property photos passed the successful
  publication check at that time; original provenance is retained.
- Sharing, stable property links, gallery swipe controls, published-address maps
  and the web Home Screen guide are implemented. The guide's presence was checked
  publicly; a dedicated browser click-through check could not run because the
  browser-prompt service had insufficient credits.

## Limitations and pending work

- This is a bundled snapshot refreshed by web publication, not a request-time
  availability feed. Refresh an already-open page to load the latest publication.
- Missing website figures and photos remain missing. The app does not fabricate
  measurements, combine separate homes or infer current agent appointments.
- Local photo-CDN requests were blocked by the managed network; the successful
  GitHub workflow performed the actual downloads and image decoding.
- Native-device/simulator behavior has not been verified. Bundle exports alone
  do not establish native readiness.
- Apple App Store and Google Play distribution remains planning only. Enrollment,
  signing, native testing and installed-app data updates are pending.
- The separate property-website skill's saved website automations are not created
  or activated by saving this app guide. Verify their own setup and status.

## Rules and notification preparation

- The project guide is saved in the linked ChatGPT Space and repository, with
  root AGENTS.md pointing future coding sessions to it.
- Four notification preferences are implemented: Available, Coming Soon, Both
  (default), and None, with per-device browser persistence when available.
- Optional OneSignal delivery, consent controls, standalone Home Screen metadata
  and a post-publication sender are prepared. No service account or keys exist
  in this session, so live push delivery is disabled and end-to-end testing is
  pending. The app discloses this status.
- Local browser checks passed at 320, 390, 768 and 1280 pixels, including
  notification-choice changes, explicit None surviving reload, and no false
  Enable control while delivery is unconfigured. Existing galleries, sharing,
  maps and navigation checks also passed. Real push delivery remains pending.
- The website subsequently added 222 West Virginia Avenue, Dunbar, WV 25064 to
  Coming Soon. The importer now accepts and preserves published ZIP/ZIP+4 codes
  on these cards; earlier cards without a published ZIP still import normally.
