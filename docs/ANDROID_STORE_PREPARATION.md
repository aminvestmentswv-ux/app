# Android release preparation

Status: local draft, not a signed release or store submission. Updated November 8, 2026.

## Confirm the release identity and policy

Use the company's existing Play app record if one exists. Confirm its permanent
package name and next unused integer version code before supplying
`AM_ANDROID_PACKAGE` and `AM_ANDROID_VERSION_CODE`. Do not reuse
`com.aminvestments.nativeqatest`, the disposable emulator identity. The Android
configuration and preflight now reject that identity explicitly.

Supply `EXPO_PUBLIC_PRIVACY_POLICY_URL` only after the policy has been reviewed
for mobile-app coverage. The current official website policy is not by itself
approval of native-app disclosures. A syntactically accepted URL does not prove
policy adequacy. Review feed/photo hosting logs and user-initiated map/share and
agent-contact handoffs; do not blindly select “no data collected.”

## Prepare the actual release

1. Reconcile the native client and requested buyer features with current main.
   Review/test the final candidate and obtain the required production publication
   approval. The live website is not changed by these local preparations.
2. Obtain verified current inventory from the established importer, run the
   complete regression suite, and run `npm run check:native-release` with confirmed
   environment values. It validates bundled freshness and the actual HTTPS feed.
   Do not rewrite inventory timestamps, substitute fixture data, or bypass gates.
3. Reuse the organization's authorized signing setup. Creating keys or persistent
   EAS/Google access requires explicit approval. Never put keys, passwords or
   service-account JSON into the public repository or logs.
4. Build the `android-production` profile as an AAB; use `android-preview` only
   for the separately authorized APK testing route. Check any build-service cost
   before starting. The Expo project must belong to the company and be confirmed.
5. Inspect the final AAB package/version, release signature and certificate,
   minimum/target SDK, permissions and bundled SDKs. Confirm ARM64 support and
   16 KB native-library/ZIP alignment using current official Android tooling.
   JavaScript exports and the prior x86_64 development APK do not prove these.
6. Test the resulting release-equivalent installed application, including cold
   start, current feed, overnight accepted inventory, genuine stale feed warning,
   offline fallback/recovery, repeated navigation/Back, photo gestures, large
   text, safe-area layout, and canceled/failed map/share/call/text handoffs.
   No test should automatically call or send a message. Recheck the privacy link
   in the actual packaged app and ensure no QA overlay/test deep link is present.
7. Prepare final screenshots from that version and accurate Play listing,
   content-rating, target-audience, ads/app-access and Data safety answers.
   Review the completed forms and confirm upload/submission separately.

## Known acceptance evidence

The earlier isolated Android API 36 emulator run passed 16 checks:
https://github.com/aminvestmentswv-ux/app/actions/runs/42331829293
Its source commit is 437fb7a8bcb8284c721a5749bdabc58649b224bc. It validated
live inventory adoption, feed-failure fallback/recovery and navigation, with
screenshots reviewed. It does not cover the newer contact/schedule changes,
physical phones, ARM64/16 KB packaging, production signing, or external handoffs.
The iPhone simulator also passed its earlier suite; Apple enrollment approval
and signed physical-iPhone testing are separate gates.

## Requested buyer features remain part of readiness

Do not label the old browsing app complete while later requirements are missing.
The requirements assessment records verified listing-agent call/text, an optional
buyer agent, primary-source fallback to MLS/Zillow with clear warnings, verified
status transitions and daytime refresh. Track draft implementation and test
coverage separately. A signed-in MLS review session is not an unattended feed,
public redistribution license or permission to expose private MLS fields.
Do not invent listing-agent mobile numbers or infer Sold from a disappeared page
or anticipated closing date.

## Remaining owner/account decisions

- Confirm existing Google organization account/app state, company-owned owner
  account and permanent package/version. Reuse records; do not create duplicates.
- Approve accurate mobile privacy policy and source/provider disclosures.
- Confirm authorized signing/build access and actual release/test destination.
- Provide approved listing-contact/source route and any rights needed to publish
  MLS/Zillow-derived data; keep private review information out of public feeds.
- Complete required physical-device and external-handoff acceptance, then approve
  any account payment, legal terms, uploads or final submission at the proper step.

No registration, payment, credentials, agreement acceptance, store upload,
production merge or deployment has occurred in this work.
