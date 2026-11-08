import { describe, expect, it } from 'vitest';
import { dayOf, relativeDays, shortDate } from './dates';

const now = new Date('2026-11-08T15:00:00.000Z');
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

describe('relativeDays', () => {
  it('APP-44 says "hoje" under 24 hours', () => {
    expect(relativeDays(now.toISOString(), now)).toBe('hoje');
    expect(relativeDays(hoursAgo(23.99), now)).toBe('hoje');
  });

  it('APP-44 says "há 1 d" from exactly 24 hours', () => {
    expect(relativeDays(hoursAgo(24), now)).toBe('há 1 d');
    expect(relativeDays(hoursAgo(47.99), now)).toBe('há 1 d');
  });

  it('APP-44 counts whole days after that', () => {
    expect(relativeDays(hoursAgo(48), now)).toBe('há 2 d');
    expect(relativeDays(hoursAgo(24 * 21 + 5), now)).toBe('há 21 d');
  });

  it('APP-44 takes `now` as given: the same date reads differently for two moments', () => {
    const at = '2026-11-01T15:00:00.000Z';
    expect(relativeDays(at, new Date('2026-11-01T20:00:00.000Z'))).toBe('hoje');
    expect(relativeDays(at, new Date('2026-11-04T15:00:00.000Z'))).toBe('há 3 d');
  });

  it('APP-44 says "hoje" for a date ahead of `now`', () => {
    expect(relativeDays(hoursAgo(-3), now)).toBe('hoje');
  });
});

describe('shortDate', () => {
  it('APP-70 gives "20 out" for the 20th of October', () => {
    expect(shortDate('2026-10-20T15:00:00.000Z')).toBe('20 out');
  });

  it('APP-70 reads the day in São Paulo, not in UTC', () => {
    expect(shortDate('2026-10-21T02:30:00.000Z')).toBe('20 out');
    expect(shortDate('2026-10-20T03:00:00.000Z')).toBe('20 out');
    expect(shortDate('2026-10-20T02:59:00.000Z')).toBe('19 out');
  });

  it('APP-70 abbreviates the twelve months in lower case without a period, with two digits for the day', () => {
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const shown = months.map((_, index) => shortDate(new Date(Date.UTC(2026, index, 5, 15)).toISOString()));
    expect(shown).toEqual(months.map((month) => `05 ${month}`));
  });
});

describe('dayOf', () => {
  it('APP-72 gives the calendar day in São Paulo', () => {
    expect(dayOf(new Date('2026-11-09T01:00:00.000Z'))).toBe('2026-11-08');
    expect(dayOf(new Date('2026-11-09T03:00:00.000Z'))).toBe('2026-11-09');
  });
});
