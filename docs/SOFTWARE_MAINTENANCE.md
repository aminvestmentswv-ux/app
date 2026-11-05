# Software maintenance

## Checks prepared in the November 5, 2026 safeguard PR

The existing hourly workflow already imports atomically, validates the app, decodes
active property photos, preserves previous immutable assets, waits for the exact
Pages commit, and checks published iPhone startup responses. Keep these checks.

The proposed additions are:

- Read-only pull-request CI: locked dependencies, type check, existing and new
  regression tests, web export, local HTML links/assets, and browser startup/recovery.
  It uses the bundled snapshot and a synthetic push identifier, without a live
  import, deployment credentials, publication, or property notifications.
- Before publishing: reject imports more than one hour old or over five minutes
  in the future; write `health.json` containing only a schema version and import time.
  The normal freshness check is deliberately not applied to the bundled source
  snapshot in PR CI: hourly imports do not update that source file.
- An independent read-only hourly check at minute 47 checks both the last successful
  refresh run and the live health file. Either older than four hours fails. The
  window tolerates routine schedule delays. Missing/malformed health metadata fails.
  This catches a failed import, stale publication, and refreshes that stop running.
  GitHub schedule suspension can also suspend this watchdog; retain the existing
  external monitor. No new external notification service is configured.
- Static references in every exported HTML file must resolve to nonempty files
  inside the export. Remote listing links remain checked during import; active
  remote photos remain covered by the existing download/decode check. This is not
  an exhaustive crawler of external maps, social-sharing sites, or sold photos.

Workflow failures are visible in Actions. Email delivery depends on each person's
GitHub notification settings and is not guaranteed by this PR. These checks become
active only after merge; a first watchdog run before the first updated publication
may fail because the old app has no health file. Review CI is advisory unless a
separate authorized repository rule requires it; no security settings are changed.

## Small software backlog and review history

Use GitHub Issues only for software bugs and enhancements, with the included forms.
Each issue needs a reproducible public/synthetic example and acceptance criteria.
Keep property operations in Basecamp and customer follow-ups in REsimpli. Do not
copy private case details or private document links into this public repository.
Use one issue per improvement, reference it in a draft PR, record tests, review,
then merge only when authorized. Close the issue when verified. Existing commits
and PRs provide change history; no second project board or paid service is needed.

Before approving a product change, verify CI and its limitations. Production stays
on the current app while a draft is reviewed. Failed prepublication checks leave
the current deployment alone. A failure *after* Pages accepts new files is different:
inspect the failed run and live site; there is no automatic rollback guarantee.
For recovery, revert the faulty source change in a reviewed PR and let the normal
workflow rebuild with a fresh import. Do not force-push deployment history or
bypass checks. Previous deployment commits and retained assets remain available
for investigation; asset retention alone is not a whole-site rollback.

## Separate decisions still needed

The Deal Analyzer calculation source is not present in this repository. Do not
invent formulas here. Locate its actual source and owner-approved definitions for
rehab, financing, fees, and profit; then add synthetic known-answer and boundary
cases there before changing its calculations.

GitHub Pages merits a separate hosting-policy review. The current official
[Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
restrict sites primarily facilitating commercial transactions and online business
hosting. This app displays for-sale inventory and purchase-contact actions; that
makes applicability worth confirming with GitHub Support. Inspection alone does
not establish a violation. No hosting, domain, access, security, or plan changes
are part of this work.

Every successful hourly refresh currently creates a new deployment commit and
requests a Pages rebuild, even if property content is unchanged. The importer
updates its check time, and `publish_pages.py` does not compare content before
`commit-tree`, push, and POST to the Pages builds API. Failed prepublication checks
prevent that run from deploying. Pushes to main and manual runs can add deployments.
GitHub documents a soft ten-builds-per-hour limit with an exception for custom
Actions workflows, plus size/bandwidth limits; this hourly cadence by itself does
not demonstrate a limit violation. Hosting eligibility and usage limits are
separate questions. No deployment-cadence change is included.
