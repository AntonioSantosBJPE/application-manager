import { describe, expect, it } from 'vitest';
import { DEFAULT_APPLICATIONS_FILTERS, parseApplicationsSearch, searchOf } from './filters';

describe('parseApplicationsSearch', () => {
  it('APP-46 gives the default filters for an address without search', () => {
    expect(parseApplicationsSearch({})).toEqual({
      tab: 'active',
      status: [],
      level: [],
      workModel: [],
      q: '',
      sort: 'activity',
      newApplication: false,
    });
    expect(DEFAULT_APPLICATIONS_FILTERS).toEqual(parseApplicationsSearch({}));
  });

  it('APP-46 reads every filter, the lists separated by comma', () => {
    expect(
      parseApplicationsSearch({
        tab: 'closed',
        status: 'accepted,ghosted',
        level: 'mid,senior',
        workModel: 'remote,onsite',
        q: 'postgres',
        sort: 'created',
        new: 1,
      }),
    ).toEqual({
      tab: 'closed',
      status: ['accepted', 'ghosted'],
      level: ['mid', 'senior'],
      workModel: ['remote', 'onsite'],
      q: 'postgres',
      sort: 'created',
      newApplication: true,
    });
  });

  it('APP-46 ignores an unknown value, one by one, and keeps the valid ones of the same list', () => {
    expect(parseApplicationsSearch({ tab: 'all', sort: 'name', status: 'applied,foo,offer', level: 'boss', workModel: 'remote,,' })).toEqual({
      tab: 'active',
      status: ['applied', 'offer'],
      level: [],
      workModel: ['remote'],
      q: '',
      sort: 'activity',
      newApplication: false,
    });
  });

  it('APP-46 counts a value given twice once', () => {
    expect(parseApplicationsSearch({ status: 'applied,applied' }).status).toEqual(['applied']);
  });

  it('APP-46 ignores values of the wrong type, which the router parses from json', () => {
    expect(parseApplicationsSearch({ tab: 3, status: ['applied'], level: 7, workModel: null, sort: {}, q: { a: 1 } })).toEqual(
      DEFAULT_APPLICATIONS_FILTERS,
    );
  });

  it('APP-46 accepts a q of exactly 100 characters, refuses a longer one, and reads a numeric q', () => {
    expect(parseApplicationsSearch({ q: 'x'.repeat(100) }).q).toBe('x'.repeat(100));
    expect(parseApplicationsSearch({ q: 'x'.repeat(101) }).q).toBe('');
    expect(parseApplicationsSearch({ q: 7 }).q).toBe('7');
    expect(parseApplicationsSearch({ q: Number.NaN }).q).toBe('');
  });

  it('APP-83 keeps new=1 through the parse and ignores any other value', () => {
    expect(parseApplicationsSearch({ new: 1 }).newApplication).toBe(true);
    expect(parseApplicationsSearch({ new: '1' }).newApplication).toBe(true);
    expect(parseApplicationsSearch({ new: 0 }).newApplication).toBe(false);
    expect(parseApplicationsSearch({ new: 'yes' }).newApplication).toBe(false);
  });
});

describe('searchOf', () => {
  it('APP-46 omits the default of each filter so the plain list has a plain address', () => {
    expect(searchOf(DEFAULT_APPLICATIONS_FILTERS)).toEqual({});
    expect(searchOf({ ...DEFAULT_APPLICATIONS_FILTERS, tab: 'active', sort: 'activity' })).toEqual({});
  });

  it('APP-46 writes what differs from the default, the lists joined by comma', () => {
    expect(
      searchOf({
        tab: 'closed',
        status: ['accepted', 'ghosted'],
        level: ['mid'],
        workModel: ['remote', 'hybrid'],
        q: 'node',
        sort: 'created',
        newApplication: false,
      }),
    ).toEqual({
      tab: 'closed',
      status: 'accepted,ghosted',
      level: 'mid',
      workModel: 'remote,hybrid',
      q: 'node',
      sort: 'created',
    });
  });

  it('APP-83 writes new=1 only when the dialog is to open', () => {
    expect(searchOf({ ...DEFAULT_APPLICATIONS_FILTERS, newApplication: true })).toEqual({ new: 1 });
  });

  it('APP-46 gives the same filters back after a round trip', () => {
    const filters = {
      tab: 'closed' as const,
      status: ['rejected' as const],
      level: ['junior' as const, 'senior' as const],
      workModel: [],
      q: 'post gres',
      sort: 'created' as const,
      newApplication: true,
    };
    expect(parseApplicationsSearch(searchOf(filters))).toEqual(filters);
  });
});
