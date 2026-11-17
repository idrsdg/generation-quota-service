import type { Pool } from 'pg';
import type { Cursor } from './cursor.js';

export interface Generation {
  id: string;
  prompt: string;
  result: string;
  cached: boolean;
  createdAt: string;
}

interface GenerationRow {
  id: string;
  prompt: string;
  result: string;
  cached: boolean;
  created_at: Date;
}

const COLUMNS = 'id, prompt, result, cached, created_at';

function toGeneration(row: GenerationRow): Generation {
  return {
    id: row.id,
    prompt: row.prompt,
    result: row.result,
    cached: row.cached,
    createdAt: row.created_at.toISOString(),
  };
}

export class GenerationStore {
  constructor(private readonly db: Pool) {}

  async insert(userId: string, prompt: string, result: string, cached: boolean): Promise<Generation> {
    const inserted = await this.db.query<GenerationRow>(
      `INSERT INTO generations (user_id, prompt, result, cached)
       VALUES ($1, $2, $3, $4)
       RETURNING ${COLUMNS}`,
      [userId, prompt, result, cached],
    );
    return toGeneration(inserted.rows[0]!);
  }

  /**
   * Keyset pagination, newest first. Reads only `limit` rows, straight from
   * generations_user_history_idx; (created_at, id) is unique, so rows sharing a
   * timestamp are neither skipped nor repeated.
   */
  async listPage(userId: string, limit: number, cursor: Cursor | null): Promise<Generation[]> {
    const page = cursor
      ? await this.db.query<GenerationRow>(
          `SELECT ${COLUMNS} FROM generations
           WHERE user_id = $1 AND (created_at, id) < ($2::timestamptz, $3::bigint)
           ORDER BY created_at DESC, id DESC
           LIMIT $4`,
          [userId, cursor.createdAt, cursor.id, limit],
        )
      : await this.db.query<GenerationRow>(
          `SELECT ${COLUMNS} FROM generations
           WHERE user_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT $2`,
          [userId, limit],
        );
    return page.rows.map(toGeneration);
  }
}
