import { expect, test } from 'vitest';
import { decodeCursor, encodeCursor } from '../src/cursor.js';

const forge = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

test('cursors round-trip, and forged cursors are rejected instead of reaching the database', () => {
  const cursor = { createdAt: '2026-11-17T06:11:38.123Z', id: '42' };
  expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);

  // "1" is a valid date for JavaScript but not for PostgreSQL: it is passed on in ISO form.
  expect(decodeCursor(forge(['1', '5']))?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  const forged = [
    ['x', '5'],
    ['-200000-01-01T00:00:00Z', '5'],
    ['2026-11-17T06:11:38Z', '5x'],
    ['2026-11-17T06:11:38Z', '9999999999999999999'], // larger than a bigint
    [1, 2],
    'nope',
  ];
  for (const bad of forged) {
    expect(decodeCursor(forge(bad))).toBeNull();
  }
  expect(decodeCursor('%%%')).toBeNull();
});
