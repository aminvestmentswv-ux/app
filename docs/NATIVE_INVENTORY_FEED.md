# Native inventory feed and importer reliability

Preparation status: approved for normal review and deployment; publication must
be verified against the actual workflow result. This change does not activate
native screens, enroll developer accounts, create signing credentials, or submit
an app. Installed iOS/Android acceptance gates remain separate.

## Why the endpoint returned 404

Main commit fb1d10b builds the website without a top-level `properties.json`.
The native feed exporter previously existed only in a local preparation draft.
A missing file is therefore expected, not evidence that the importer deleted a
published feed. Adding client retries alone cannot fix this 404.

## Proposed publication path

The existing hourly workflow refreshes the official website, validates code/data,
exports the web app and exports a schema-validated `properties.json` into the same
artifact. Existing freshness, asset/photo, domain, deployment and iPhone-startup
checks remain in place. A new check after startup verification fetches the public
feed and requires it to match the complete verified artifact before alerts run.
The review workflow also exports the feed into its local test artifact.

The feed contains public listing information already shown in the property app.
The exporter allowlists listing/metadata/image fields, discards unknown fields,
and replaces internal correction reasons with a generic public provenance label. Requests omit
credentials and reject redirects. The native loader validates schema, source
hosts, status provenance, response size and freshness; it rejects older snapshots.
Post-publication verification allows up to six attempts, with a 12-second request
limit and five-second gaps (97 seconds of configured waits plus overhead).
Every attempt must pass the full comparison. HTTP access denials and other
nontransient HTTP errors stop immediately. Logs contain safe error categories,
not response-body excerpts. A persistent 404 remains a failing release check.

## Importer timeout handling

The prior importer made one 30-second request per page. The observed Chappell
failure was curl timeout 28. On recheck, the same URL returned HTTP 200 in 4.66
seconds and parsed correctly. This establishes no persistent missing-page or
parser defect; it does not identify the remote server/network cause.

The proposed importer makes at most three attempts for temporary transport
failures and HTTP 408/429/500/502/503/504. Each attempt has a 10-second connection
limit, 30-second curl limit and 35-second process backstop, with one- and two-
second retry gaps. Certificate/protocol errors, access denials, missing pages,
unexpected destinations, wrong media types and invalid property markup fail
closed. Only complete successful official-source HTML enters the per-run cache.
Partial downloads are removed; old-run HTML is never reused.

Results retain source order even when requests finish out of order. A fatal
result cancels queued detail requests; already-running requests finish within
their limits. All source validation and the final atomic inventory replacement
remain unchanged, so an unsuccessful import preserves the previous snapshot.

## Tests and approval boundary

The isolated draft passes TypeScript, 124 tests (48 Node, 76 Python), a web export
and the exact inventory export check. Tests cover retries/exhaustion, denied
requests, partial-cache cleanup, source order, queued-request cancellation,
snapshot preservation, malformed data, complete feed comparison and safe logs.
The post-publication check correctly reports the current live feed as HTTP 404.

Publication requires authorization to push/merge the narrow repository change
through the established reviewed workflow, which deploys on main. Do not dispatch
a deployment, change hosting/DNS, weaken checks or bypass protections merely to
test this draft. After authorized publication, verify that exact deployment and
its live feed before claiming availability or proceeding with native tests.

## Live follow-up evidence

A complete local import using the bounded-retry implementation finished at
2026-11-07T01:32:11Z: 174 properties, with 4 Available, 7 Coming Soon, 0 Under
Contract and 163 Sold. It recovered from five temporary request failures. The
final schema parser accepted that snapshot. The queued-request cancellation and
exact-media-type refinements were regression-tested afterward, and the final
fetch implementation successfully read and parsed 917 Chappell Rd again. The
full import was not redundantly repeated after those refinements.

The fresh snapshot remains local evidence, not a committed or deployed inventory.
The publication workflow must run its own fresh import and all existing checks.
