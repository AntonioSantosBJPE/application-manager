import { FUNNEL_ORDER } from '@am/contracts';
import { isUuid } from './ids.js';

/**
 * Where a page of the list stopped: the funnel position of the last row's status, its date (the last
 * activity, or the creation date with `sort=created`) and its id.
 */
export interface ApplicationCursor {
  rank: number;
  at: Date;
  id: string;
}

/** The cursor is opaque to the client: base64url of the JSON of `{ rank, at, id }` (APP-15). */
export function encodeCursor(cursor: ApplicationCursor): string {
  return Buffer.from(JSON.stringify({ rank: cursor.rank, at: cursor.at.toISOString(), id: cursor.id }), 'utf8').toString('base64url');
}

/** The cursor a text names, or `undefined` when it is not base64url JSON with a `rank` of 0 to 7, an ISO `at` and a uuid `id` (APP-17). */
export function decodeCursor(text: string): ApplicationCursor | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const { rank, at, id } = parsed as { rank?: unknown; at?: unknown; id?: unknown };
  if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 0 || rank >= FUNNEL_ORDER.length) return undefined;
  if (typeof at !== 'string' || typeof id !== 'string' || !isUuid(id)) return undefined;
  const date = new Date(at);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== at) return undefined;
  return { rank, at: date, id };
}
