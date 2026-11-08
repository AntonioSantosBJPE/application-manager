import { describe, expect, it } from 'vitest';
import { formatDate } from './dates';

describe('formatDate', () => {
  it('writes the day, the month in three letters and the year', () => {
    expect(formatDate('2026-11-15T12:00:00.000Z')).toBe('15 nov 2026');
    expect(formatDate('2026-03-02T12:00:00.000Z')).toBe('02 mar 2026');
  });

  it('names every month the way a Brazilian reads it', () => {
    const months = Array.from({ length: 12 }, (_, month) =>
      formatDate(new Date(Date.UTC(2026, month, 10, 12)).toISOString()),
    );

    expect(months).toEqual([
      '10 jan 2026',
      '10 fev 2026',
      '10 mar 2026',
      '10 abr 2026',
      '10 mai 2026',
      '10 jun 2026',
      '10 jul 2026',
      '10 ago 2026',
      '10 set 2026',
      '10 out 2026',
      '10 nov 2026',
      '10 dez 2026',
    ]);
  });

  it('reads the day in São Paulo, not in UTC', () => {
    // 02:00 UTC on the 15th is still the 14th at 23:00 in São Paulo (UTC-3).
    expect(formatDate('2026-11-15T02:00:00.000Z')).toBe('14 nov 2026');
    expect(formatDate('2026-11-15T03:00:00.000Z')).toBe('15 nov 2026');
  });

  it('gives nothing for an instant that is not a date', () => {
    expect(formatDate('not a date')).toBeUndefined();
    expect(formatDate('')).toBeUndefined();
  });
});
