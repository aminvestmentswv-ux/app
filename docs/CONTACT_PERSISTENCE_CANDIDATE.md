# Own-agent persistence candidate: November 8, 2026

Local development only, based on test/native-live-feed-2026-11-07 at
cba3c71bed80f49a2160938c168fa57fe725175a. No production deployment, account
registration, signing credential, store upload, or source publication by this work.

## Implemented

- Explicit save/edit/clear of an optional buyer-provided agent name and US/Canada
  phone number. Validation is formatting only, not proof of ownership or SMS support.
- Web storage is this app origin's localStorage. Native storage is two app-private
  Expo documents slots. The prior valid slot is retained until the next edit or
  clear; neither slot is transmitted.
- A fresh app store loads the saved contact. No contact permission, server upload,
  analytics, or automatic message/call is added. OS backup may include native app
  documents, as disclosed in the UI. This is not encrypted secret storage or a promise of durability through
  device power loss. The single app-level store serializes writes.
- Saving writes only the inactive slot and verifies the bytes before success.
  An incomplete write leaves the prior valid slot intact. An uncertain write is
  accepted only after exact read-back. Clearing first verifies a null tombstone,
  then removes the other slot and finally the tombstone, checking both absences.
  A failed clear never reports success or resurrects an older contact. Read/corruption errors allow explicit replacement
  or clearing. Changes are blocked while initial loading or another change is pending.
- expo-file-system is now an explicit dependency using the already-locked SDK58
  package. Production signing and release identity are unchanged.

## Verification and limits

- TypeScript, focused storage regression tests, and the full Node/Python suite pass.
- Android, iOS and web JavaScript exports pass. Export is not a native installed build.
- Browser restart-save and restart-clear checks are added to the existing suite.
  Separate corrupt/read/write/clear error UI checks are prepared.
- Android test harness now cold-restarts after save and after clear, in addition to
  its prior navigation/edit/validation checks. iPhone XCTest persistence coverage is
  prepared. They use the disposable QA identity and a reserved example phone number.
- New browser execution stopped before tests: Chromium cannot create its singleton
  socket in this environment. New native simulator suites are not run yet. A hosted
  test run of the final candidate is required; earlier simulator passes do not cover
  this change.

## Before release

Run the updated browser error/reload suite and both native simulator suites, inspect
screenshots and actual on-device persistence, then complete release-equivalent
physical-device testing and external handoff checks. No test sends a message or
places a call.

Review mobile privacy disclosures for the optional saved contact and OS backups,
alongside feed/photo hosting and user-initiated third-party handoffs. The local code
does not itself authorize publishing legal text.

Other product/account/source/signing gates in ANDROID_STORE_PREPARATION.md remain.
This feature does not supply verified listing-agent mobile numbers, MLS/Zillow feed
rights, final package/version, Play organization setup, ARM64/16KB signed bundle,
or physical iPhone acceptance. The prepared daytime refresh schedule is unchanged
and is not activated by this work.
