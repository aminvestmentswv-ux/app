# Native store submission preparation

Prepared November 9, 2026. This is a review draft, not a submitted release.
The property app is distinct from the Foreclosure Desk and Deal Analyzer.

## Release status

- Company Apple Developer enrollment is pending review, per owner report.
- Google Play organization account is verified, including company/representative
  identity and contact/developer phone numbers. Registration payment is complete.
  The owner-approved **AM Investments** draft app was created (app ID
  `4975698751714411829`), using Android package `com.aminvestmentswv.properties`.
  Store category is House & Home; the approved public company contacts are saved.
  No signed build has been uploaded, and no release has been submitted.
- The owner selected a United States-only launch on November 9, 2026. Set app
  production distribution is saved as **United States: Targeted (1)** in Google
  Play. Google groups seven locations under this country entry. App Store Connect
  availability remains pending. A trader declaration does not set app availability.
  Google explicitly permits non-trader declaration when apps are not distributed
  in the EEA or UK; the approved Non-trader declaration is saved. Review it if
  distribution expands. The company's website ownership is verified in Play.
- Company Expo organization and project were created. The source config points to
  the [property project](https://expo.dev/accounts/am-investments-wv/projects/am-investments)
  with public project ID `2a076a64-b41c-4889-bc6b-83dadf3d9209`.
- This draft connects the existing validated public inventory loader to native UI.
  Startup, foreground return and Refresh properties request the published feed.
  Invalid, stale or failed responses retain the last valid in-memory snapshot.
  A cold offline launch uses the bundled snapshot and its actual checked date.
  There is no persistent downloaded inventory cache or background refresh.
- The web publication and push system remain separate. Native push is not enabled
  or advertised in this proposed first release. No automatic store submission is configured.

## Company account and signing setup

Use company-controlled accounts. Complete organization verification with the exact
legal company name, D-U-N-S record and supporting documents. Do not put identity
documents, payment details, signing keys, account passwords or service-account JSON
in this public repository. Confirm fees on the enrollment screens before payment.

After enrollment, register permanent iOS and Android app identifiers. Configure
the public values in `.env.example` in the company Expo environment. Do not paste
sample identifiers into real store records. Link the existing source to the
verified Expo project; do not generate a replacement starter application.

`eas.json` prepares an internal APK/ad-hoc preview profile and production AAB/iOS
store builds with remotely incremented build numbers. Production config refuses
to resolve without both identifiers, a project ID and an HTTPS privacy URL. This
is a configuration check, not proof of published-policy accuracy or release approval.
Set the same values when resolving configuration for build and submission.

After review, commit the exact tested source and authenticate EAS locally using
the company's account. Run the preview build first, then production builds only
after the device checklist below passes. An iOS ad-hoc preview requires registered
devices and appropriate signing; it is not an iOS Simulator build.

```sh
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile production --platform all
```

Record and select the exact build ID for subsequent upload; avoid `--latest` when
multiple builds exist. The Android submission profile targets an internal draft,
not production. Google Play requires a first manual upload before API submission.
An iOS upload reaches App Store Connect/TestFlight; selecting a build, completing
metadata and sending it for App Review are separate steps. No auto-submit command
should be added until the account and release details have been verified.

## Privacy and review declarations

Publish an app-specific, publicly accessible HTML privacy policy, then set
`EXPO_PUBLIC_AM_PRIVACY_URL`; the native footer opens that policy and official
company support website. A policy draft is in `STORE_LISTING_DRAFT.md`. The owner
must confirm company/contact information, hosting logs, providers and retention
before it can become final. Do not declare "no data collected" solely because
the application has no sign-in form.

Inventory and remote photographs cause HTTPS requests to the app host and image
providers. Review their IP/device/log handling. Search terms stay in app state in
this source; maps use a property address and open externally on native. Sharing
opens a user-selected destination. The native app currently has no login,
payments, ads, analytics initialization or native notification SDK. Audit the
actual signed package, generated permissions, SDK privacy manifests, required
reason APIs, encryption declaration and network traffic before submitting either
store's privacy questionnaire. Do not reuse web OneSignal disclosures blindly.

Complete Apple's current age-rating/export-compliance and App Privacy forms and
Google's Data safety, content rating, target audience, ads, app access and any
applicable declarations. Account deletion becomes necessary if account creation
is later introduced. A privacy policy is required even without account creation.

## Required physical-device acceptance evidence

Record build ID, commit, device/OS, result and evidence for each test. All remain
pending until actually executed on signed builds:

1. Install/cold launch/background/foreground/relaunch on iPhone, iPad (tablet
   support is declared) and Android, including safe areas and Android system bars.
2. Load the public feed, confirm the checked date, refresh manually, and resume
   from background. Confirm changed status/counts and an already-open detail
   reflect the accepted snapshot; a removed property must close safely.
3. Disable networking; retain saved content without claiming it is current. Test
   failed, stale, malformed and slow responses and recovery after reconnecting.
4. Search all four statuses, empty results, missing fields/photos, Sold paging,
   galleries and vertical scroll. Confirm no purchase claim for Sold/Under Contract.
5. Open original listing and maps; test system share and cancelled share. Check
   the Coming Soon-only phone action without placing an unintended call.
6. Open privacy/support links. Inspect actual permissions; do not request precise
   location or push access for the current feature set.
7. VoiceOver/TalkBack, large text, contrast, touch targets, rotation/tablet layout
   and Android back-button navigation. Resolve defects before recording a pass.

Use actual signed-app screenshots for the store, with current truthful property
content. Capture inventory search, property details/facts, gallery and Coming Soon.
Include tablet assets if required by the declared device support. Prepare the
Google Play feature graphic using the approved logo; never substitute generated
or unrelated property photographs. Use each console's current image specifications.

## Submission sequence

1. Finish account verification and signing; confirm app identifiers and owner.
2. Review this change through existing CI; verify the live inventory feed and age.
3. Publish the approved privacy policy and verify support/contact paths.
4. Build and test signed native previews, then upload the reviewed release builds.
5. Finish store metadata, screenshots, ratings and privacy forms from evidence.
6. Run TestFlight/Play testing and address reports. For Google personal accounts
   created after November 13, 2023, the documented gate is 12 continuously opted-in
   testers for 14 days before applying for production access. Organization account
   requirements must be checked in the actual console; do not assume that personal
   account testing rule applies to the company account.
7. Submit for store review with manual release selected where available. Store
   acceptance is determined by Apple/Google, not by a successful JavaScript export.

## Official references checked November 9, 2026

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play review preparation](https://support.google.com/googleplay/android-developer/answer/9859455)
- [Google user data and privacy policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Google testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Google trader-status and EEA/UK exception](https://support.google.com/googleplay/android-developer/answer/17594752)
- [Expo build configuration](https://docs.expo.dev/build/eas-json/)
- [Expo version management](https://docs.expo.dev/build-reference/app-versions/)
- [Expo submission introduction](https://docs.expo.dev/submit/introduction/)

Apple guideline 4.2 requires adequate utility beyond a repackaged website. Review
this native catalog's real search, galleries, status browsing, sharing and inventory
updates against that requirement; approval cannot be guaranteed.
