import type { Pool } from 'pg';

export class QuotaStore {
  constructor(
    private readonly db: Pool,
    private readonly dailyLimit: number,
  ) {}

  /**
   * Takes one unit of today's allowance in a single atomic statement.
   * Returns the UTC day it was taken from, or null when nothing is left.
   *
   * Concurrent requests for the same user queue up on the row lock, and each one
   * re-checks `used < limit` against the latest committed value, so at most
   * `limit` of them can ever succeed.
   */
  async reserve(userId: string): Promise<string | null> {
    const result = await this.db.query<{ day: string }>(
      `INSERT INTO daily_quotas AS q (user_id, day, used)
       VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1)
       ON CONFLICT (user_id, day) DO UPDATE
         SET used = q.used + 1
         WHERE q.used < $2
       RETURNING day::text AS day`,
      [userId, this.dailyLimit],
    );
    return result.rows[0]?.day ?? null;
  }

  /** Gives the unit back after a provider failure. Uses the day returned by reserve(). */
  async release(userId: string, day: string): Promise<void> {
    await this.db.query(
      `UPDATE daily_quotas SET used = used - 1
       WHERE user_id = $1 AND day = $2::date AND used > 0`,
      [userId, day],
    );
  }
}
