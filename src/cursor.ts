export interface Cursor {
  createdAt: string;
  id: string;
}

/** Opaque to the client: base64url of [createdAt, id] of the last item on the page. */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt, cursor.id])).toString('base64url');
}

const MAX_CURSOR_TIME = Date.UTC(9999, 11, 31);
const MAX_BIGINT = 9223372036854775807n;

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [createdAt, id] = parsed;
    if (typeof createdAt !== 'string') return null;
    // JavaScript accepts date strings PostgreSQL rejects (e.g. "1"), so pass on a canonical ISO value.
    const time = Date.parse(createdAt);
    if (Number.isNaN(time) || time < 0 || time > MAX_CURSOR_TIME) return null;
    if (typeof id !== 'string' || !/^\d{1,19}$/.test(id) || BigInt(id) > MAX_BIGINT) return null;
    return { createdAt: new Date(time).toISOString(), id };
  } catch {
    return null;
  }
}
