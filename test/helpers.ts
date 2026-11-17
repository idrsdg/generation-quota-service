import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import type { Redis } from 'ioredis';
import type { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { createPool } from '../src/db.js';
import type { AiProvider } from '../src/provider/ai-provider.js';
import { createRedis } from '../src/redis.js';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './env.js';

/** Test double for the provider: answers immediately and counts its calls. */
export class CountingProvider implements AiProvider {
  calls = 0;

  async generate(prompt: string): Promise<string> {
    this.calls += 1;
    return `Sonuç: ${prompt}`;
  }
}

export interface TestContext {
  app: FastifyInstance;
  db: Pool;
  redis: Redis;
  provider: CountingProvider;
  baseUrl: string;
  generate(userId: string, prompt: string): Promise<Response>;
  usedQuota(userId: string): Promise<number>;
  close(): Promise<void>;
}

/** Starts the real app on a random port against the real PostgreSQL and Redis, with clean state. */
export async function startTestApp(): Promise<TestContext> {
  const db = createPool(TEST_DATABASE_URL);
  const redis = createRedis(TEST_REDIS_URL);
  if (redis.status !== 'ready') {
    await once(redis, 'ready');
  }
  await db.query('TRUNCATE generations, daily_quotas RESTART IDENTITY');
  await redis.flushdb();

  const provider = new CountingProvider();
  const app = buildApp({ db, redis, provider, config, logger: false });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const { port } = app.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    app,
    db,
    redis,
    provider,
    baseUrl,
    generate: (userId, prompt) =>
      fetch(`${baseUrl}/v1/generations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ prompt }),
      }),
    usedQuota: async (userId) => {
      const result = await db.query<{ used: number }>(
        `SELECT used FROM daily_quotas
         WHERE user_id = $1 AND day = (now() AT TIME ZONE 'UTC')::date`,
        [userId],
      );
      return result.rows[0]?.used ?? 0;
    },
    close: async () => {
      await app.close();
      await db.end();
      redis.disconnect();
    },
  };
}
