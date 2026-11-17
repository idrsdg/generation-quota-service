export interface Cursor {
  createdAt: string;
  id: string;
}

/** Opaque to the client: base64url of [createdAt, id] of the last item on the page. */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt, cursor.id])).toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [createdAt, id] = parsed;
    if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
    if (typeof id !== 'string' || !/^\d{1,19}$/.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
