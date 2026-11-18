# Isolated backend checkpoint

AM Property Watch was provisioned in the approved existing company organization on the Free plan ($0/month quoted); us-east-1, ACTIVE_HEALTHY. Workspace data was not accessed or changed.

Private property_watch schema only, three RLS-enabled tables, no anon/authenticated schema/table/function permissions, no public endpoints and no stored subscriber records. Delivery is false and a CHECK constraint prevents enabling it accidentally. Existing main sender also remains hard-paused.

Transactional synthetic checks passed: repeated watch is idempotent and preserves start time; revoke removes only that installation's watches; revoked installation cannot re-enable; other device remains intact. Tests rolled back. Final registry counts both zero.

Security advisor returned three INFO rls_enabled_no_policy notices. Intentional deny-all policy until a server-only adapter is reviewed; no permissive policy was added to silence the notices. https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

Still pending: secure device enrollment, production adapter/auth endpoints, SDK consent/revocation integration, outbox/event processing and approved real-device tests. No live Watch UI or notification delivery claim.
