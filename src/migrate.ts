import { config } from './config.js';
import { runMigrations } from './migrations.js';

await runMigrations(config.databaseUrl);
