import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG_FILTERS, parseCatalogSearch, searchOf } from './filters';

describe('parseCatalogSearch', () => {
  it('SKL-41 gives the default filters for an address without search', () => {
    expect(parseCatalogSearch({})).toEqual({ scope: 'all', category: undefined, q: '' });
    expect(DEFAULT_CATALOG_FILTERS).toEqual({ scope: 'all', category: undefined, q: '' });
  });

  it('SKL-41 keeps a valid scope, category and q', () => {
    expect(parseCatalogSearch({ scope: 'private', category: 'database', q: 'postgres' })).toEqual({
      scope: 'private',
      category: 'database',
      q: 'postgres',
    });
    expect(parseCatalogSearch({ scope: 'global' }).scope).toBe('global');
  });

  it('SKL-41 falls back to the default for each invalid value, one by one', () => {
    expect(parseCatalogSearch({ scope: 'mine', category: 'database', q: 'a' })).toEqual({
      scope: 'all',
      category: 'database',
      q: 'a',
    });
    expect(parseCatalogSearch({ scope: 'private', category: 'fruit', q: 'a' })).toEqual({
      scope: 'private',
      category: undefined,
      q: 'a',
    });
    expect(parseCatalogSearch({ scope: 'private', category: 'database', q: 'x'.repeat(61) })).toEqual({
      scope: 'private',
      category: 'database',
      q: '',
    });
    expect(parseCatalogSearch({ scope: 3, category: ['tool'], q: { a: 1 } })).toEqual({
      scope: 'all',
      category: undefined,
      q: '',
    });
  });

  it('SKL-41 accepts a q of exactly 60 characters and reads a numeric q, which the router parses as a number', () => {
    expect(parseCatalogSearch({ q: 'x'.repeat(60) }).q).toBe('x'.repeat(60));
    expect(parseCatalogSearch({ q: 7 }).q).toBe('7');
    expect(parseCatalogSearch({ q: Number.NaN }).q).toBe('');
  });
});

describe('searchOf', () => {
  it('SKL-41 omits the default of each filter so the plain catalog has a plain address', () => {
    expect(searchOf(DEFAULT_CATALOG_FILTERS)).toEqual({});
  });

  it('SKL-41 writes only what differs from the default', () => {
    expect(searchOf({ scope: 'private', category: undefined, q: '' })).toEqual({ scope: 'private' });
    expect(searchOf({ scope: 'all', category: 'tool', q: '' })).toEqual({ category: 'tool' });
    expect(searchOf({ scope: 'all', category: undefined, q: 'nest' })).toEqual({ q: 'nest' });
    expect(searchOf({ scope: 'private', category: 'tool', q: 'nest' })).toEqual({
      scope: 'private',
      category: 'tool',
      q: 'nest',
    });
  });

  it('SKL-41 round-trips through parseCatalogSearch', () => {
    const filters = { scope: 'private', category: 'cloud_devops', q: 'docker' } as const;

    expect(parseCatalogSearch(searchOf(filters))).toEqual(filters);
  });
});
