# Real isolated DB concurrency checkpoint

Applied private_atomic_enrollment_limiter to the isolated AM Property Watch project. Eight concurrent connector SQL transactions exercised the same four limiter dimensions. Distinct PostgreSQL backend PIDs:11510,11512,11513,11527,11516,11518,11517,11526. Exactly3 returned true and5 false, matching the limit; no errors/deadlocks. Synthetic test keys removed; final remaining test rows0.

Anonymous/authenticated schema usage remains false. Security advisor reports5 informational deny-all RLS-without-policy notices only. No public API, broad schema grants or permissive policies added.

Private parameterized adapters now invoke actual DB functions for limiter and enrollment, ignoring client clocks/thresholds. Local typecheck,74Node,86Python pass. Adapter SQL functions have real DB evidence; an application-owned database network connection has NOT been exercised. Connector administrative query execution is not proof of production app connectivity.

Remaining concrete connection gate: provision a least-privilege server runtime/DB connection and secure credential storage in the isolated property project. Do not reuse Workspace credentials, put DB secrets in GitHub public files, expose private schema through public Data API, or grant broad client access to sidestep this gate. No credentials were retrieved/changed and no function deployed during this checkpoint. Once secure runtime exists, run adapters through it with synthetic records before any device-test approval.
