import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';

/**
 * The cache is an optimisation, never a source of truth:
 * if Redis is unreachable a read counts as a miss and a write is skipped.
 */
export class ResultCache {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
    private readonly log: FastifyBaseLogger,
  ) {}

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.log.warn({ err: error }, 'cache read failed, treating as a miss');
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', this.ttlSeconds);
    } catch (error) {
      this.log.warn({ err: error }, 'cache write failed, skipping');
    }
  }
}
