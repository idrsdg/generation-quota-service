import { afterEach, beforeEach, expect, test } from 'vitest';
import { startTestApp, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(async () => {
  ctx = await startTestApp();
});

afterEach(async () => {
  await ctx.close();
});

test('10 concurrent requests from one user: exactly 5 succeed, 5 get 429, 5 rows are saved', async () => {
  const prompts = Array.from({ length: 10 }, (_, index) => `concurrent prompt ${index}`);

  const responses = await Promise.all(prompts.map((prompt) => ctx.generate('user-a', prompt)));

  const statuses = responses.map((response) => response.status);
  expect(statuses.filter((status) => status === 201)).toHaveLength(5);
  expect(statuses.filter((status) => status === 429)).toHaveLength(5);

  for (const response of responses.filter((r) => r.status === 429)) {
    expect(await response.json()).toEqual({ error: 'quota_exceeded' });
  }

  const saved = await ctx.db.query('SELECT count(*)::int AS count FROM generations WHERE user_id = $1', [
    'user-a',
  ]);
  expect(saved.rows[0].count).toBe(5);
  expect(await ctx.usedQuota('user-a')).toBe(5);
  // Rejected requests never reached the provider.
  expect(ctx.provider.calls).toBe(5);
});
