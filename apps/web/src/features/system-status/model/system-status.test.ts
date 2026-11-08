import { describe, expect, it } from 'vitest';
import { componentsInOrder, verdictOf, type ServiceState } from './system-status';

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
