import { afterEach, beforeEach, expect, test } from 'vitest';
import { startTestApp, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(async () => {
  ctx = await startTestApp();
});

afterEach(async () => {
  await ctx.close();
});

test('a differently written version of a prompt is served from the cache without using quota', async () => {
  const first = await ctx.generate('user-b', 'merhaba');
  expect(first.status).toBe(201);
  const firstBody = await first.json();
  expect(firstBody).toMatchObject({ prompt: 'merhaba', result: 'Sonuç: merhaba', cached: false });
  expect(ctx.provider.calls).toBe(1);
  expect(await ctx.usedQuota('user-b')).toBe(1);

  const second = await ctx.generate('user-b', '  MERHABA ');
  expect(second.status).toBe(201);
  const secondBody = await second.json();
  expect(secondBody).toMatchObject({ prompt: 'MERHABA', result: 'Sonuç: merhaba', cached: true });

  // The provider was not called again and the remaining quota did not move.
  expect(ctx.provider.calls).toBe(1);
  expect(await ctx.usedQuota('user-b')).toBe(1);

  // The cached response is still part of the user's history.
  const history = await fetch(`${ctx.baseUrl}/v1/generations`, { headers: { 'x-user-id': 'user-b' } });
  const { items } = await history.json();
  expect(items.map((item: { cached: boolean }) => item.cached)).toEqual([true, false]);
});
