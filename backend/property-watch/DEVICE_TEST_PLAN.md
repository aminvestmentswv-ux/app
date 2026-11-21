# Release gate: authorized device-only proof test

NOT READY TO SEND. No challenge sender is implemented or deployed. All defaults
remain disabled and database delivery CHECK remains false. Do not test using the
whole subscriber audience, segments, or a device inferred from existing records.

## Before asking Andrew for device authorization

1. Complete atomic production rate-limiter adapter, five-minute challenge issuance,
   origin/auth/preflight/deadline controls and trusted-gateway IP extraction.
   Limiter contract currently conservative: maximum3 attempts per15min across
   global, IP digest, browser digest and subscription digest, consumed atomically.
   Never reset limits on success or substitute client-provided IP.
2. Add server-only credential storage handoff; no keys in frontend/public variables.
3. Verify SDK foreground/background click support with synthetic fixtures. Receipt
   goes only in device notification data, never initial HTTP response or logs.
4. Prove API enrollment refuses to run while safety flags are false and rejects
   direct supplied subscription ID/SDK token claims without challenge proof.
5. Independently review receipt leakage, click-link fragment removal, DB transactions,
   rate-limit concurrency, challenge retries, failed sends and key/session rotation.

## Proposed exact authorization request when ready

Ask permission to send ONE clearly labeled 'AM Investments verification test'
notification to Andrew's explicitly identified test browser installation only.
Identify browser/device and whether foreground/background. No other subscribers,
no property marketing alert and no subscription/backlog enabling. After that test,
request additional sends separately if needed. Do not use current approval as
permission to send this test now.

## Acceptance tests

- Browser A initiates; only A receives receipt; B cannot consume A's proof even
  knowing its challenge/subscription ID. Mismatched initiating secret rejected.
- Successful consume creates one installation; replay and expiration rejected.
- Device opting out mid-enrollment produces no watch or success claim.
- UI Watching appears only after registry ack and only when delivery is enabled
  in an independently reviewed launch. Failures stay honest; button hidden now.
- Stop watching affects just that property/device; global None removes all device
  watches and suppresses pending sends. Browser permission revocation respected.
- Recovery clears all old watches, invalidates old token and requires fresh
  per-property consent. New device requires new proof, never a bearer migration.
- Safari Home Screen/iPhone and Android native are separate tests, not inferred
  from desktop success. No Expo Identity Verification toggle changes.

## Current offline coverage

Parameterized server-side store adapter passes only bearer digests to DB; atomic
watch/revoke functions used. Limiter boundary hashes sensitive dimensions. Recovery
policy never revives watches. These are domain/adapter tests, not a deployed
end-to-end system. SQL concurrency, rate-limit storage and actual device receipt
remain unverified.
