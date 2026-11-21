# Disabled enrollment candidate

Ownership cannot be proven by a client-supplied subscription UUID alone. The selected candidate uses two independent 256-bit secrets: browser secret retained in initiating browser; receipt secret delivered ONLY to the requested push subscription. Server stores digests. Both are required to consume a five-minute one-use challenge and issue an installation bearer once. Receipt must never be returned to initiating HTTP client, logged or placed in URL query; notification click fragment must be removed before telemetry/navigation. This is a candidate, not a validated real-device flow.

No challenge notification sender exists yet. No real messages were sent. Enrollment and HTTP entry points default disabled and are not deployed. Challenge issuance must be globally rate limited, per-IP/device/subscription bounded, replay protected, and require explicit visitor consent to the verification notification. Verify original browser binding and global opt-out. The provider SDK click/service-worker path must be proven on authorized test devices before activation. Native remains separate.

Isolated DB tests: wrong/null proofs rejected, valid proof accepted once, replay rejected, no duplicate installation. Synthetic transaction rolled back, leaving zero installations/challenges. Enrollment uses server time in SQL. Existing subscription uniqueness rejects takeover/rotation rather than silently reassociating. Rotation/recovery remains unfinished.

Candidate HTTP boundary validates origin (not treated as authentication), bearer, JSON and streamed4KB limit, hides internal errors and sets no-store. Still requires deadline/rate limits, preflight, storage adapter and security review. Tests:64Node,86Python, typecheck pass. No live UI claims.

OneSignal identity verification alternative has Web support but not Expo/React Native as of docs checked Nov18; do not enable app-wide toggle. https://documentation.onesignal.com/docs/en/identity-verification
