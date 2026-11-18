import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

/**
 * Applies pending SQL migrations. node-pg-migrate takes an advisory lock, so two instances
 * never migrate at once; one that starts while another is migrating fails instead of waiting.
 */
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
