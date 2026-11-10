import { monthSchema } from '@am/contracts';

/**
 * `YYYY-MM` of the contract ↔ the `date` column on day 1 (RES-11). Both ways are string work: a `Date`
 * would shift the day with the time zone of the server.
 */
export function toMonthDate(month: string): string {
  return `${monthSchema.parse(month)}-01`;
}

/** The `date` column comes back as `YYYY-MM-DD`; the month is its first seven characters (RES-12). */
export function fromMonthDate(date: string): string {
  return date.slice(0, 7);
}
