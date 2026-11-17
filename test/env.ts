export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://app:app@localhost:54329/app_test';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:63799/1';
