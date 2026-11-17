import { Redis } from 'ioredis';

export function createRedis(redisUrl: string): Redis {
  const redis = new Redis(redisUrl, {
    // Fail fast instead of piling commands up in memory while Redis is down:
    // the cache layer turns a failure into a cache miss.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    commandTimeout: 500,
    connectTimeout: 1_000,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });
  redis.on('error', (error) => console.error('redis error', error.message));
  return redis;
}
