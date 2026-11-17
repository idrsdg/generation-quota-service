import pg from 'pg';

export function createPool(databaseUrl: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 2_000,
  });
  // An idle connection dropping must not crash the process.
  pool.on('error', (error) => console.error('postgres pool error', error.message));
  return pool;
}
