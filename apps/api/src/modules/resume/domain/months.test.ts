import { afterEach, describe, expect, it } from 'vitest';
import { fromMonthDate, toMonthDate } from './months.js';

const originalZone = process.env.TZ;
afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

describe('resume months', () => {
  it('RES-11 stores a month as the first day of it', () => {
    expect(toMonthDate('2023-03')).toBe('2023-03-01');
  });

  it('RES-12 reads the first day back as the month', () => {
    expect(fromMonthDate('2023-03-01')).toBe('2023-03');
  });

  it.each(['2023-01', '2023-12', '2024-02'])('RES-11 round-trips %s (January, December, a leap year)', (month) => {
    expect(fromMonthDate(toMonthDate(month))).toBe(month);
  });

  it.each(['America/Sao_Paulo', 'UTC', 'Pacific/Kiritimati'])('RES-12 changes no day in %s', (zone) => {
    process.env.TZ = zone;
    expect(toMonthDate('2023-01')).toBe('2023-01-01');
    expect(fromMonthDate('2023-01-01')).toBe('2023-01');
    expect(fromMonthDate(toMonthDate('2024-12'))).toBe('2024-12');
  });

  it('RES-11 refuses a value that is not a month', () => {
    expect(() => toMonthDate('2023-13')).toThrow();
    expect(() => toMonthDate('2023-3')).toThrow();
  });
});
