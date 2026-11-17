import pg from 'pg';
import { runMigrations } from '../src/migrations.js';
import { TEST_DATABASE_URL } from './env.js';

/** Creates the dedicated test database (if missing) and migrates it. Runs once per test run. */
export default async function setup(): Promise<void> {
  const target = new URL(TEST_DATABASE_URL);
  const databaseName = target.pathname.slice(1);

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await admin.end();
  }

  await runMigrations(TEST_DATABASE_URL, false);
}
