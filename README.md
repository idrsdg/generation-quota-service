# Generation Quota Service

Node.js 24 · TypeScript · Fastify · PostgreSQL 17 · Redis 7

## Setup and tests

```bash
docker compose up --build                          # API on http://localhost:3000
docker compose run --rm test                       # both tests, real PostgreSQL and Redis
docker compose exec app node dist/scripts/seed.js  # 100,000 rows for user "seed-user"
```

Migrations live in `migrations/` and run when the service starts.

## Quota under concurrent requests

The quota is one PostgreSQL row per user per UTC day. A single
`INSERT … ON CONFLICT DO UPDATE SET used = used + 1 WHERE used < 5` reserves a unit before
the provider is called. Concurrent requests queue on the row lock and re-check the condition,
so at most five pass. A provider error or timeout gives the unit back.

## Index and EXPLAIN

`(user_id, created_at DESC, id DESC)` matches the keyset query; `id` breaks timestamp ties.
A page 50,000 rows deep into 100,000:

```
Limit (actual time=0.051..0.055 rows=21 loops=1)
  Buffers: shared hit=4
  -> Index Scan using generations_user_history_idx on generations (actual time=0.050..0.053 rows=21 loops=1)
       Index Cond: ((user_id = 'seed-user') AND (ROW(created_at, id) < ROW('2026-11-17 06:11:38+00', '50017')))
Execution Time: 0.119 ms
```

## One technical choice

The quota is stored in PostgreSQL, not Redis. It survives restarts and Redis outages and is
shared by every instance, for the price of one small write per uncached request. Redis is
only a cache and fails open.

## Time spent and known gaps

Time spent: TODO(idris) hours.

- A crash between reserving and refunding costs that user one unit; the limit is never exceeded.
- Identical prompts arriving at the same moment both reach the provider (no single-flight).
- No idempotency key: a client retry counts as a new generation.
- `limit` above 100 is clamped to 100.

## AI usage

TODO(idris)

The scaling question is answered in [NOTES.md](NOTES.md).
