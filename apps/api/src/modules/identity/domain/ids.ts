/**
 * A UUID in the canonical text form the contracts write (the shape Postgres accepts for a `uuid`
 * column). An id that is not one names no row, and asking Postgres about it would be a `500` for a
 * request the client got wrong, so the check happens before the query (ADM-03, EDGE-02).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
