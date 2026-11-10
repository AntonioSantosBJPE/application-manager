const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** What a range shows for an end that is not set: still working, or still studying (RES-50). */
export const OPEN_END_LABEL = 'atual';

/**
 * "mar 2023" from `2023-03`: the month abbreviated in lower case, without a period, and the year. The value
 * is a month, not an instant, so it is read from the text and never through a `Date`: no time zone can
 * move it to the month before.
 */
export function formatMonth(month: string): string {
  const [year, number] = month.split('-');
  const name = MONTHS[Number(number) - 1];
  return name === undefined || year === undefined ? month : `${name} ${year}`;
}

/** "jan 2021 — fev 2023", or "mar 2023 — atual" when the end is null (RES-49, RES-50). */
export function formatRange(start: string, end: string | null): string {
  return `${formatMonth(start)} — ${end === null ? OPEN_END_LABEL : formatMonth(end)}`;
}
