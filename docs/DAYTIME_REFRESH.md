# Daytime inventory refresh draft

Prepared November 8, 2026. Local draft only; not activated on production.

Scheduled collection uses America/New_York hours 07 through 21, retaining minute
17. The UTC cron covers the union of standard/daylight hours, and a separate job
checks the actual execution-time local hour before admitting the refresh job.
Manual and source-push runs remain permitted at any hour. The check is based on
execution time rather than the nominal trigger, so a delayed scheduled workflow
starting at 22:00 does not collect. GitHub scheduling is best effort. Once admitted,
a running import may finish after the window; this does not cancel partial work.

Native launch, foreground and manual fetch are not time-gated. The published
inventory timestamp remains the actual successful collection time. The overnight
exception changes freshness acceptance, not property facts or their verified date.

During normal daytime operation the existing four-hour maximum age remains.
After the last evening slot, the previous evening snapshot can remain usable
through 08:16:59 the next morning. It must be timestamped at or after 20:17 local
(one hour before the final 21:17 slot), so a missed final cycle is tolerated but
older evening outages are not. At 08:17 the normal four-hour bound applies again:
an absent morning refresh then fails. This provides one hour after the first
07:17 morning slot for scheduling and publication. DST is evaluated using real
UTC hours and New York local time; a fixed UTC offset is not used.

The same policy is applied to native feed ingestion, both native release
preflights and the published-health check. Newly imported data must still pass
the strict one-hour publication check. Future dates beyond five minutes remain
invalid. The freshness watchdog reads the actual published checkedAt, not the
latest green workflow: a scheduled no-op must never imply a fresh import.

Tests cover summer/winter, both DST transitions, midnight rollover, all 15 daily
slots, 06:59/07:00/21:59/22:00 boundaries, manual/push events, overnight tolerance,
missed morning collection, daytime expiration and future/naive timestamps.

Before activation, review this draft with the complete client changes and use the
normal repository review/deployment process. Existing installed old clients have
a four-hour limit and will reject overnight inventory until updated; do not deploy
the daytime schedule ahead of the corresponding client release/rollout decision.
