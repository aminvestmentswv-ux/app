# Property watch candidate: NOT DEPLOYED

Safety checkpoint 2026-11-18. `service.ts` is an isolated domain layer, not an HTTP
endpoint. `WatchPropertyButton.tsx` is not mounted anywhere. No subscriber sends.
The existing sender remains hard-paused. The stored OneSignal key passed a
non-sending HTTP 200 authentication check separately.

## Proposed isolated persistence

Create a separate company Supabase project only after organization confirmation.
No reads/writes to the private Workspace project's data. Use a non-exposed schema
with RLS enabled and no anon/authenticated grants. Edge/backend service alone may
access it. No service key in public app bundles or public GitHub variables.

Tables: installations (random id, SHA256 bearer token digest, verified provider
subscription, verified_at, expires_at, revoked_at); watches (installation FK,
property id, consent_version, started_at; unique installation/property); verified
inventory snapshots; price_events; delivery_outbox (unique event/subscription,
stable UUID idempotency key, accepted/delivered distinction). No raw bearer tokens
or provider credentials in database rows, responses, logs, or telemetry.

Authentication must derive installation identity from a high-entropy bearer token.
Request body installation/subscription IDs are forbidden. Enrollment requires
cryptographic/provider-backed proof of subscription ownership BEFORE persistence.
An untrusted client giving a valid OneSignal subscription UUID is NOT proof.

Production DB adapter must implement atomic putWatchIfActive: lock installation,
recheck non-revoked, verified, unexpired identity and active consent, then upsert
watch without moving started_at on repeated watch. Revoke transaction marks
installation revoked and removes all watches/pending outbox records. A separate
fresh opt-in/enrollment is required; generic push enable must never restore watches.

## Enrollment blocker / native constraint

OneSignal Identity Verification currently supports Web SDK160900+ and native
Android/iOS, but not Expo/React Native. Do not turn on app-wide enforcement until
all clients are compatible. Source: https://documentation.onesignal.com/docs/en/identity-verification
A browser implementation can use server-authenticated identity + signed OneSignal
login, followed by server provider-state verification. This needs reviewed identity
key setup and session/auth UI. Alternatively a device-only ownership challenge
requires an explicitly authorized test send and server-verifiable challenge flow.
Neither path is implemented or silently enabled here. Do not weaken this gate to
ship the button faster.

## Before release

- Provision isolated project, implement/test RLS and transactional adapters.
- Implement session enrollment/ownership verification, origin checks, bounded input,
  rate limits, revocation endpoint and retention/deletion; never rely on CORS as auth.
- Complete SDK opt-in, browser permission and global-None integration.
- Mount button only when live service and delivery readiness are both verified;
  display Watching only after server ack, fail honestly on unavailable service.
- Seed a fresh price baseline silently. Gaps over3h seed silently. No old replay.
- Recheck consent/provider validity immediately before any eventual send.
- Test storage failure, permission refusal, two-device separation, races, rotations,
  duplicate retries, expired events and deep links with synthetic data first.
- Obtain test-device send approval; test signed native builds separately.

Current tests: typecheck;57Node,86Python pass. No live DB, visual UI or real-device
verification is claimed. No backend account created or legal/paid terms accepted.
