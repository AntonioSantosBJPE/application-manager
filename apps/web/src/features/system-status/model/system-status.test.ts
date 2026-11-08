import { describe, expect, it } from 'vitest';
import { componentsInOrder, formatCheckedAt, verdictOf, type ServiceState } from './system-status';

describe('verdictOf', () => {
  it('PRU-06 AC21 is operational only when the API and the database both are', () => {
    expect(verdictOf({ api: 'operational', database: 'operational' })).toBe('operational');
  });

  it.each<[ServiceState, ServiceState]>([
    ['operational', 'unavailable'],
    ['unavailable', 'operational'],
    ['unavailable', 'unavailable'],
  ])('PRU-06 AC22 is degraded with API %s and database %s', (api, database) => {
    expect(verdictOf({ api, database })).toBe('degraded');
  });
});

describe('componentsInOrder', () => {
  it('PRU-06 AC21 lists the API before the database when both answer', () => {
    expect(componentsInOrder({ api: 'operational', database: 'operational' })).toEqual([
      { component: 'api', state: 'operational' },
      { component: 'database', state: 'operational' },
    ]);
  });

  it('PRU-06 AC22 puts the unavailable database at the top', () => {
    expect(componentsInOrder({ api: 'operational', database: 'unavailable' })).toEqual([
      { component: 'database', state: 'unavailable' },
      { component: 'api', state: 'operational' },
    ]);
  });

  it('PRU-06 AC22 keeps the API first when it is the one unavailable', () => {
    expect(componentsInOrder({ api: 'unavailable', database: 'operational' })).toEqual([
      { component: 'api', state: 'unavailable' },
      { component: 'database', state: 'operational' },
    ]);
  });

  it('PRU-06 AC22 keeps the API first when both are unavailable', () => {
    expect(componentsInOrder({ api: 'unavailable', database: 'unavailable' })).toEqual([
      { component: 'api', state: 'unavailable' },
      { component: 'database', state: 'unavailable' },
    ]);
  });
});

describe('formatCheckedAt', () => {
  it('PRU-06 AC21 prints the date and the time of the read in São Paulo', () => {
    expect(formatCheckedAt('2026-11-08T17:32:07.000Z')).toEqual({
      date: '08 nov 2026',
      time: '14:32:07',
    });
  });

  it('reads the day in São Paulo, not in UTC, on a 24-hour clock', () => {
    expect(formatCheckedAt('2026-11-09T02:05:09.000Z')).toEqual({
      date: '08 nov 2026',
      time: '23:05:09',
    });
    expect(formatCheckedAt('2026-03-02T03:00:00.000Z')).toEqual({
      date: '02 mar 2026',
      time: '00:00:00',
    });
  });

  it('gives nothing for an instant that is not a date', () => {
    expect(formatCheckedAt('not a date')).toBeUndefined();
  });
});
