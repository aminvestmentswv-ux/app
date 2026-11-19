# Private database readiness probe
Not the watch enrollment API. No notification sender. HTTP always returns 503.
Only a Cloudflare scheduled event matching one exact UTC minute and a 60-second
wall-clock window can use the encrypted WATCH_DB_PASSWORD binding. It connects
only to the owner-provided shared pooler and restricted property_watch_runtime
login, with TLS certificate verification and bounded connect/query timeouts.
Queries run sequentially in a READ ONLY transaction. Only fixed pass/fail markers
are logged. Neither errors, SQL results, tail data nor credentials are printed.

The Actions harness inherits the secret from the deployed disabled-shell version,
never reads its value, and verifies private URL flags before and after deployment.
A temporary dated Cron trigger waits 20 minutes for propagation. It is removed
and the original disabled shell restored, including an independent always-run
cleanup step. The minute gate also fails closed if interrupted before cleanup.
A schedule can remain after infrastructure loss; inspect and remove it rather
than claiming cleanup based only on attempted actions.

Tests: node --test probe.test.mjs; node build.mjs 0; test bundle without credentials.
Do not rerun while another operator edits staging. Never change production alert
pause or expose a public route to test this. This read-only probe verifies login
and permissions metadata, not enrollment mutations or subscriber delivery.

Diagnostics revision: ws trace-v1 client now sends heartbeat pings and terminates explicitly after awaited cleanup. Fixed EVENT/STARTED/SKIPPED and connection/query/check failure categories distinguish invocation, transport, and database issues without logging errors or results. Schedule removal tolerates short metadata propagation delay. No broader permissions or exposure added.

## Metadata-read visibility guard (offline revision, not yet deployed)
Version POST is never retried by the visibility helper. Only the exact version GET
may retry HTTP 404, at most five attempts within a ten-second wall-clock budget.
Each request abort timeout uses the remaining budget. Other statuses, malformed
JSON, timeout/network failures, exact-content mismatches, or an active deployment
identity mismatch fail closed. Both ordinary and independent cleanup use the
same helper and retain module, encrypted-binding and public-URL checks. A success
also requires that the expected version is the sole 100% active deployment.
This handles a possible transient visibility failure; it does not establish that
Cloudflare's observed metadata 404 was caused by propagation.
