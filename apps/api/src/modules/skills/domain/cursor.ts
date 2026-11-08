import { normalizeSkillKey } from '@am/contracts';
import { isUuid } from './ids.js';

/** Where a page of the admin list stopped: the last row's normalized key and id. */
export interface SkillCursor {
  key: string;
  id: string;
}

/** The cursor is opaque to the client: base64url of the JSON of `{ key, id }` (SKL-37). */
export function encodeCursor(cursor: SkillCursor): string {
  return Buffer.from(JSON.stringify({ key: cursor.key, id: cursor.id }), 'utf8').toString('base64url');
}

/** The cursor a text names, or `undefined` when it is not base64url JSON with a normalized `key` and a uuid `id`. */
export function decodeCursor(text: string): SkillCursor | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const { key, id } = parsed as { key?: unknown; id?: unknown };
  if (typeof key !== 'string' || typeof id !== 'string' || !isUuid(id)) return undefined;
  if (key !== normalizeSkillKey(key)) return undefined;
  return { key, id };
}
