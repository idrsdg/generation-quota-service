export interface Config {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  dailyQuota: number;
  cacheTtlSeconds: number;
  providerTimeoutMs: number;
  maxPromptLength: number;
  maxUserIdLength: number;
  bodyLimitBytes: number;
}

export const config: Config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:54329/app',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:63799',
  // Must stay in sync with the CHECK constraint on daily_quotas.used.
  dailyQuota: 5,
  cacheTtlSeconds: 600,
  providerTimeoutMs: 3000,
  maxPromptLength: 2000,
  maxUserIdLength: 128,
  // 2,000 characters are at most 8 KB in UTF-8; 16 KB leaves room for JSON escaping.
  bodyLimitBytes: 16 * 1024,
};
