# AM Investments Property App — Progress Notes

Standing rules: [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md).
Technical commands: [README.md](README.md).
Saved project: [AM Investments Property App Space](https://chatgpt.com/space/page_6ad5790192448191bd458c0dd106b1aa).

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
