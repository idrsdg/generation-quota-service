# If the service scales to 10 instances and Redis is unavailable for one minute

- **Quota stays correct.** It lives in PostgreSQL, and all 10 instances run the same atomic
  statement against the same row. Redis is not involved in the decision.
- **The cache degrades to "always miss".** Reads fail fast (no offline queue, 500 ms command
  timeout) and count as a miss; writes are skipped. The service keeps answering, but every
  request reaches the provider and uses quota, so for that minute users spend allowance on
  prompts that would have been free, and provider load rises. The daily quota caps the damage.
- **Recovery is clean.** Nothing was written during the outage, so no wrong or stale data
  appears; the cache simply refills.
- **What I would change:** a circuit breaker around Redis, so a slow (not refused) Redis does
  not add up to 500 ms to every request; single-flight per normalized prompt to soften the
  cold-cache stampede after recovery.
- **Also for 10 instances:** 10 pools of 10 connections reach PostgreSQL's default limit of
  100, so I would shrink the pools or add PgBouncer, and run migrations as a deploy step
  instead of on every start.

# AI usage

I used AI for most of the implementation and the first draft of these notes.
I made the design decisions with it, reviewed every file, and verified the result with
typecheck, the integration tests against real PostgreSQL and Redis, and the full verification
flow from the case.
