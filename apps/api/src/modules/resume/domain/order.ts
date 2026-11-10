import { isUuid } from './ids.js';

/** True only when `sent` holds exactly the ids of `existing`, each once, in any order (RES-27). */
export function isExactOrder(sent: readonly string[], existing: readonly string[]): boolean {
  if (sent.length !== existing.length) return false;
  if (!sent.every(isUuid)) return false;
  const wanted = new Set(existing);
  return new Set(sent).size === sent.length && sent.every((id) => wanted.has(id));
}
