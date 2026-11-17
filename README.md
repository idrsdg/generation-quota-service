# Generation Quota Service

Node.js 24, TypeScript, Fastify, PostgreSQL 17, Redis 7.

## Setup and tests

```bash
docker compose up --build                          # http://localhost:3000
docker compose run --rm test                       # real PostgreSQL and Redis
docker compose exec app node dist/scripts/seed.js  # 100,000 rows, user "seed-user"
```

Migrations (`migrations/`) run on start.

## Quota under concurrency

One PostgreSQL row per user per UTC day. A single
`INSERT … ON CONFLICT DO UPDATE SET used = used + 1 WHERE used < 5` reserves a unit before
the provider call; concurrent requests queue on the row lock and re-check the condition, so
at most five pass. Provider errors and timeouts refund the unit.

## Index and EXPLAIN

`(user_id, created_at DESC, id DESC)` matches the keyset query; `id` breaks timestamp ties.
Page 50,000 rows deep into 100,000:

```
Limit (actual time=0.051..0.055 rows=21)
  Buffers: shared hit=4
  -> Index Scan using generations_user_history_idx (actual rows=21)
       Index Cond: (user_id = 'seed-user') AND (ROW(created_at, id) < ROW('2026-11-17 06:11:38+00', 50017))
Execution Time: 0.119 ms
```

## One technical choice

Quota lives in PostgreSQL, not Redis: it survives restarts and Redis outages and is shared
by all instances, for one small write per uncached request. Redis is only a cache and fails open.

## Time spent and known gaps

Time spent: TODO(idris) hours.

- A crash between reserve and refund costs the user one unit; the limit is never exceeded.
- Simultaneous identical prompts both reach the provider (no single-flight).
- No idempotency key.
- `limit` above 100 is clamped.

## AI usage

TODO(idris)

Scaling question: [NOTES.md](NOTES.md).
