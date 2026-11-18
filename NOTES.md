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
  not add up to 500 ms per command (a miss does one read and one write) to every request; single-flight per normalized prompt to soften the
  cold-cache stampede after recovery.
- **Also for 10 instances:** 10 pools of 10 connections reach PostgreSQL's default limit of
  100, so I would shrink the pools or add PgBouncer, and run migrations as a deploy step
  instead of on every start.

# AI usage

I used AI for most of the implementation and the first draft of these notes.
I made the design decisions with it, reviewed every file, and verified the result with
typecheck, the integration tests against real PostgreSQL and Redis, and the full verification
flow from the case.

# Unfinished parts

None: every task in the brief is implemented. Known gaps are listed in the README.

# Full EXPLAIN output

The README shows a shortened plan. This is the complete output for one history page,
50,000 rows deep into the 100,000 seeded rows of `seed-user`:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, prompt, result, cached, created_at FROM generations
WHERE user_id = 'seed-user'
  AND (created_at, id) < ('2026-11-17 06:11:38+00'::timestamptz, 50017::bigint)
ORDER BY created_at DESC, id DESC
LIMIT 21;
```

```
 Limit  (cost=0.42..2.80 rows=21 width=59) (actual time=0.020..0.024 rows=21 loops=1)
   Buffers: shared hit=4
   ->  Index Scan using generations_user_history_idx on generations  (cost=0.42..5699.75 rows=50188 width=59) (actual time=0.019..0.022 rows=21 loops=1)
         Index Cond: ((user_id = 'seed-user'::text) AND (ROW(created_at, id) < ROW('2026-11-17 06:11:38+00'::timestamp with time zone, '50017'::bigint)))
         Buffers: shared hit=4
 Planning:
   Buffers: shared hit=129
 Planning Time: 0.398 ms
 Execution Time: 0.056 ms
```
