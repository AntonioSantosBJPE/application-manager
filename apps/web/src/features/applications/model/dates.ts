/** Every date on screen is read in the author's zone, the same on the server render and in the browser. */
export const TIME_ZONE = 'America/Sao_Paulo';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between `at` and `now`; 0 under 24 h and for a date in the future. */
export function daysSince(at: string | Date, now: Date): number {
  const elapsed = now.getTime() - new Date(at).getTime();
  return Math.max(0, Math.floor(elapsed / DAY_MS));
}

/**
 * The last activity of a row: "hoje" under 24 h, "há N d" after, N in whole days (APP-44). `now` comes
 * from the loader, never from a clock in here, so the same page renders the same text twice.
 */
export function relativeDays(at: string | Date, now: Date): string {
  const days = daysSince(at, now);
  return days === 0 ? 'hoje' : `há ${days} d`;
}

const shortDateParts = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: TIME_ZONE,
});

/** "20 out": two digits for the day and the month abbreviated in lower case, without the period (APP-70). */
export function shortDate(at: string | Date): string {
  const parts = shortDateParts.formatToParts(new Date(at));
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const month = (parts.find((part) => part.type === 'month')?.value ?? '').replace('.', '').toLowerCase();
  return `${day} ${month}`;
}

const dayParts = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
});

/** The calendar day of an instant in `America/Sao_Paulo`, as `YYYY-MM-DD` (the value of a date field). */
export function dayOf(at: string | Date): string {
  const parts = dayParts.formatToParts(new Date(at));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const longDateParts = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
});

/** "14 out 2026": the day, the month abbreviated in lower case without the period, and the year (APP-66). */
export function longDate(at: string | Date): string {
  const parts = longDateParts.formatToParts(new Date(at));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month').replace('.', '').toLowerCase()} ${part('year')}`;
}
