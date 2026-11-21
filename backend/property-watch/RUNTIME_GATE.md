# Least-privilege runtime gate

Provisioned property_watch_runtime as NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT, NOREPLICATION, NOBYPASSRLS in the isolated project. Only explicit watch-registry operations and four narrow functions granted. Settings read only. No auth.users read, schema CREATE or settings UPDATE permission. Registry RLS policies target only this server role, not anon/authenticated. Security advisor now reports0lints.

Metadata verified all above. Creator postgres has admin membership with inherit=false,set=false. A SET LOCAL ROLE test was explicitly denied; it was not retried by broadening permissions. Therefore runtime-role execution is NOT verified. No login credential created, no member granted to an external principal, no Edge Function deployed (function list empty).

Available deployment tool immediately serves a public URL. The connector has no secret-write or private function invocation tool. Supabase default Edge credentials include broad service-role/DB access; those were not substituted for least-privilege credentials.

Next step requires a supported secure credential setup: dedicated login restricted to property_watch_runtime, stored only in the isolated project's server secret store, plus private test invocation. Credential entry/creation in browser requires owner handoff. Do not send passwords in chat or obtain a broad organization token as a workaround. Do not enable a public enrollment endpoint to test connectivity.

Sources: https://supabase.com/docs/guides/functions/secrets and https://supabase.com/docs/guides/database/postgres/roles .
