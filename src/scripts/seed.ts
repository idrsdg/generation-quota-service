import { config } from '../config.js';
import { createPool } from '../db.js';

// Inserts 100,000 history rows for one user in a single statement.
// Three rows share every timestamp on purpose, to exercise the cursor tie-breaker.
const SEED_USER = process.argv[2] ?? 'seed-user';
const ROWS = 100_000;

const db = createPool(config.databaseUrl);
try {
  await db.query('DELETE FROM generations WHERE user_id = $1', [SEED_USER]);
  const inserted = await db.query(
    `INSERT INTO generations (user_id, prompt, result, cached, created_at)
     SELECT $1,
            'seed prompt ' || n,
            'Sonuç: seed prompt ' || n,
            false,
            date_trunc('second', now()) - (n / 3) * interval '1 second'
     FROM generate_series(1, $2::int) AS n`,
    [SEED_USER, ROWS],
  );
  await db.query('ANALYZE generations');
  console.log(`inserted ${inserted.rowCount} rows for user "${SEED_USER}"`);
} finally {
  await db.end();
}
