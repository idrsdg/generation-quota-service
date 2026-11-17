import { buildApp } from './app.js';
import { config } from './config.js';
import { createPool } from './db.js';
import { FakeAiProvider } from './provider/fake-provider.js';
import { createRedis } from './redis.js';

const db = createPool(config.databaseUrl);
const redis = createRedis(config.redisUrl);
const app = buildApp({ db, redis, provider: new FakeAiProvider(), config });

async function shutdown(): Promise<void> {
  await app.close();
  await db.end();
  redis.disconnect();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    shutdown().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

await app.listen({ host: '0.0.0.0', port: config.port });
