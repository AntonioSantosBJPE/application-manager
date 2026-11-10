import { describe, expect, it } from 'vitest';
import { formatMonth, formatRange } from './months';

describe('months', () => {
  it('RES-49 writes a month as the abbreviation in lower case and the year', () => {
    expect(formatMonth('2023-03')).toBe('mar 2023');
    expect(formatMonth('2021-01')).toBe('jan 2021');
    expect(formatMonth('2023-02')).toBe('fev 2023');
  });

  it('RES-49 names the twelve months with no period and no capital', () => {
    const names = Array.from({ length: 12 }, (_, index) => formatMonth(`2024-${String(index + 1).padStart(2, '0')}`));

    expect(names).toEqual([
      'jan 2024', 'fev 2024', 'mar 2024', 'abr 2024', 'mai 2024', 'jun 2024',
      'jul 2024', 'ago 2024', 'set 2024', 'out 2024', 'nov 2024', 'dez 2024',
    ]);
  });

  it('RES-49 does not depend on the time zone of the runtime', () => {
    const original = process.env.TZ;
    try {
      for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'UTC']) {
        process.env.TZ = zone;
        expect(formatMonth('2023-01'), zone).toBe('jan 2023');
        expect(formatMonth('2023-12'), zone).toBe('dez 2023');
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });

  it('RES-49 writes a range with both ends', () => {
    expect(formatRange('2021-01', '2023-02')).toBe('jan 2021 — fev 2023');
  });

  it('RES-50 writes "atual" for an end that is not set', () => {
    expect(formatRange('2023-03', null)).toBe('mar 2023 — atual');
  });
});
