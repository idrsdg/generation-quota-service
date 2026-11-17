import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

/** Applies pending SQL migrations. node-pg-migrate takes an advisory lock, so parallel starts are safe. */
export async function runMigrations(databaseUrl: string, verbose = true): Promise<void> {
  await runner({
    databaseUrl,
    dir: migrationsDir,
    direction: 'up',
    migrationsTable: 'pgmigrations',
    verbose,
    log: verbose ? console.log : () => {},
  });
}
