# Transport checkpoint

Candidate only, not deployed. Challenge issuer enforces explicit consent, bounded IDs and a limiter before reserving a challenge. Receipt goes only to an injected transport, never the HTTP return. Transport failure attempts cancellation and returns a generic error. No real provider implementation is installed. Disabled by default.

HTTP handler adds same-origin preflight and a5-second total read/operation deadline. A timed-out database operation may still complete; UI must reconcile from authoritative server state before retry. No delivery sends are performed by handler. Stream4KB cap and non-disclosing errors remain.

Rate-limiter SQL draft locks all sorted dimensions within one transaction. Reference implementation tested20 concurrent attempts yielding3 admissions. This does NOT prove PostgreSQL production concurrency; SQL draft not applied. Multi-connection DB concurrency test remains a release gate.

Tests: typecheck,73Node,86Python pass; focused7transport/HTTP tests pass after review. No UI mounted, public endpoint deployed, credential change or subscriber message.

Remaining before device approval: actual private DB/Edge adapter and secure credential placement, production atomic limiter tests, provider challenge payload/click receipt implementation with mocked SDK browser tests. Then one explicitly authorized device test. Native signed-build integration remains separate.
