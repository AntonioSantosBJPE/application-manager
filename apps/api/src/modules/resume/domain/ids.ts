/**
 * A UUID in the canonical text form Postgres accepts for a `uuid` column. An id that is not one names
 * no row, and asking Postgres about it would answer `500` for a request the client got wrong, so the
 * check happens before the query. Repeated here because the interior of other modules is not importable.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
