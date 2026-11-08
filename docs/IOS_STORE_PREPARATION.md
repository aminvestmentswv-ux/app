# iOS store preparation

Prepared November 7, 2026. This is build preparation, not a signed archive,
TestFlight upload or App Store submission. The existing company Apple review and
app record must be identified before choosing production values.

## Release configuration

The `ios-production` EAS profile uses store distribution, `simulator: false`,
and Node 24.22.1. It is deliberately not linked to a guessed Expo project or Apple
team. No submission profile or automatic upload is configured.

For the existing approved Apple app, provide:

- `AM_IOS_BUNDLE_IDENTIFIER`: exact bundle ID from the existing app record.
- `AM_IOS_BUILD_NUMBER`: next unused positive integer (1–9999). This conservative
  project convention avoids ambiguous version formatting; consult the app record
  before incrementing. Do not reset an existing sequence.
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`: final approved HTTPS policy on
  `www.aminvestmentswv.com`. The currently published website-only policy still
  needs mobile-app coverage; syntax validation does not establish its adequacy.

The app config consumes those values, and all EAS iOS device profiles fail closed
when any are absent. The disposable QA bundle ID is rejected. The named
`ios-simulator` profile remains an unsigned simulator-only path and must never be
changed into a device/store profile. Local web/config reads need no guessed ID.

Run `node scripts/verify_native_release.mjs --ios` as a read-only preflight. The
EAS post-install hook also checks device builds. It requires current bundled
inventory and a valid reachable public feed at least as new as that fallback.
It performs no signing, credential creation, account linking or upload. A passing
preflight is not proof of Apple membership, authorization, correct privacy
statements or store acceptance. A native Xcode build outside EAS must run this
preflight explicitly; the hook cannot protect an unrelated build system.

## Still required before submission

1. Identify the current Apple team, app/build and review state. Reuse existing
   records; never interrupt a pending review or create duplicates speculatively.
2. Confirm final app identity, marketing version, build number and mobile policy.
   Inspect hosting/CDN data practices and final linked SDKs before disclosures.
3. Obtain authorized signing access. Ask before creating credentials or expanding
   persistent access. Build the actual device archive; inspect entitlements,
   aggregated privacy manifests, required-reason APIs and packaged assets.
4. Verify the QA adapter/overlay and test-only deep links are absent. Verify
   production inventory freshness, actual request behavior and privacy link.
5. Complete physical iPhone acceptance and iPad testing while tablet support is
   declared. Simulator success does not replace device/network/handoff checks.
6. Prepare screenshots and listing information from the actual release build.
   Do not advertise native push: notification controls remain web-only.
7. Obtain authorization for the specific upload/tester distribution and final
   submission; do not infer it from this preparation request.

Existing successful simulator runs remain the evidence for application behavior
before this configuration-only change. New local tests cover the added gates;
actual signed release builds are still not produced or tested.
