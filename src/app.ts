import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import type { Config } from './config.js';
import { ResultCache } from './cache.js';
import { decodeCursor, encodeCursor, type Cursor } from './cursor.js';
import { GenerationStore, type Generation } from './generations.js';
import { cacheKey, charLength, normalizePrompt } from './normalize.js';
import { generateWithTimeout, ProviderTimeoutError, type AiProvider } from './provider/ai-provider.js';
import { QuotaStore } from './quota.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export interface AppDependencies {
  db: Pool;
  redis: Redis;
  provider: AiProvider;
  config: Config;
  logger?: boolean;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function buildApp({ db, redis, provider, config, logger = true }: AppDependencies): FastifyInstance {
  const app = Fastify({ logger, bodyLimit: config.bodyLimitBytes });

  const quota = new QuotaStore(db, config.dailyQuota);
  const cache = new ResultCache(redis, config.cacheTtlSeconds, app.log);
  const generations = new GenerationStore(db);

  // Runs before the body is parsed, so a missing header is always a 401.
  app.decorateRequest('userId', '');
  app.addHook('onRequest', async (request, reply) => {
    const header = request.headers['x-user-id'];
    const userId = typeof header === 'string' ? header.trim() : '';
    if (userId === '') {
      return reply.code(401).send({ error: 'missing_user_id' });
    }
    if (charLength(userId) > config.maxUserIdLength) {
      return reply.code(400).send({ error: 'invalid_user_id' });
    }
    request.userId = userId;
  });

  // Malformed JSON, oversized bodies and unexpected failures share one response shape.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'request failed');
      return reply.code(500).send({ error: 'internal_error' });
    }
    return reply.code(status).send({ error: status === 413 ? 'payload_too_large' : 'invalid_request' });
  });

  app.post('/v1/generations', async (request, reply) => {
    const body = request.body as { prompt?: unknown } | null | undefined;
    const rawPrompt = body?.prompt;
    if (typeof rawPrompt !== 'string') {
      return reply.code(400).send({ error: 'invalid_prompt' });
    }
    const prompt = rawPrompt.trim();
    const length = charLength(prompt);
    // PostgreSQL text cannot store NUL, so it is rejected here, before quota and provider.
    if (length === 0 || length > config.maxPromptLength || prompt.includes('\u0000')) {
      return reply.code(400).send({ error: 'invalid_prompt' });
    }

    const { userId } = request;
    const normalized = normalizePrompt(prompt);
    const key = cacheKey(normalized);

    // 1. Cache first: a hit is free, so it never touches the quota or the provider.
    const cachedResult = await cache.get(key);
    if (cachedResult !== null) {
      const generation = await generations.insert(userId, prompt, cachedResult, true);
      return reply.code(201).send(generation);
    }

    // 2. Reserve quota before the provider call, so an exhausted user never reaches it.
    const day = await quota.reserve(userId);
    if (day === null) {
      return reply.code(429).send({ error: 'quota_exceeded' });
    }

    const refund = async () => {
      try {
        await quota.release(userId, day);
      } catch (error) {
        request.log.error({ err: error, userId, day }, 'quota refund failed');
      }
    };

    // 3. Call the provider. No database transaction is held open while we wait.
    let result: string;
    try {
      result = await generateWithTimeout(provider, normalized, config.providerTimeoutMs);
    } catch (error) {
      await refund();
      if (error instanceof ProviderTimeoutError) {
        return reply.code(504).send({ error: 'provider_timeout' });
      }
      request.log.warn({ err: error }, 'provider call failed');
      return reply.code(502).send({ error: 'provider_error' });
    }

    // 4. Save, then cache. Only successful results reach this point.
    let generation: Generation;
    try {
      generation = await generations.insert(userId, prompt, result, false);
    } catch (error) {
      await refund();
      throw error;
    }
    await cache.set(key, result);
    return reply.code(201).send(generation);
  });

  app.get('/v1/generations', async (request, reply) => {
    const query = request.query as { limit?: unknown; cursor?: unknown };

    let limit = DEFAULT_PAGE_SIZE;
    if (query.limit !== undefined) {
      if (typeof query.limit !== 'string' || !/^\d{1,9}$/.test(query.limit) || Number(query.limit) < 1) {
        return reply.code(400).send({ error: 'invalid_limit' });
      }
      limit = Math.min(Number(query.limit), MAX_PAGE_SIZE);
    }

    let cursor: Cursor | null = null;
    // An empty cursor (`?cursor=`) means the first page.
    if (query.cursor !== undefined && query.cursor !== '') {
      cursor = typeof query.cursor === 'string' ? decodeCursor(query.cursor) : null;
      if (cursor === null) {
        return reply.code(400).send({ error: 'invalid_cursor' });
      }
    }

    // One extra row tells us whether another page exists without a COUNT query.
    const rows = await generations.listPage(request.userId, limit + 1, cursor);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    const nextCursor =
      rows.length > limit && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;

    return { items, nextCursor };
  });

  return app;
}
