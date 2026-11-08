import type { SkillCategory, SkillScopeFilter } from '@am/contracts';
import { SKILL_TEXT_MAX_LENGTH, skillCategorySchema, skillScopeFilterSchema } from '@am/contracts';

/** What the catalog shows: the scope chip, the category chip and the search text (SKL-41). */
export interface CatalogFilters {
  scope: SkillScopeFilter;
  category: SkillCategory | undefined;
  q: string;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = { scope: 'all', category: undefined, q: '' };

/** The URL carries only what differs from the default, so `/admin/skills` is the unfiltered catalog. */
export interface CatalogSearch {
  scope?: SkillScopeFilter;
  category?: SkillCategory;
  q?: string;
}

/**
 * Reads the filters out of the URL. The router hands over whatever the address held, parsed as json,
 * so `q=7` arrives as a number; every value that is not valid falls back to the default instead of
 * failing the page (SKL-41).
 */
export function parseCatalogSearch(raw: object): CatalogFilters {
  const given = raw as Record<string, unknown>;
  const scope = skillScopeFilterSchema.safeParse(given.scope);
  const category = skillCategorySchema.safeParse(given.category);
  const text = typeof given.q === 'number' && Number.isFinite(given.q) ? String(given.q) : given.q;
  const q = typeof text === 'string' && text.length <= SKILL_TEXT_MAX_LENGTH ? text : DEFAULT_CATALOG_FILTERS.q;
  return {
    scope: scope.success ? scope.data : DEFAULT_CATALOG_FILTERS.scope,
    category: category.success ? category.data : DEFAULT_CATALOG_FILTERS.category,
    q,
  };
}

/** The URL search of some filters: the default of each one is left out. */
export function searchOf(filters: CatalogFilters): CatalogSearch {
  const search: CatalogSearch = {};
  if (filters.scope !== DEFAULT_CATALOG_FILTERS.scope) search.scope = filters.scope;
  if (filters.category !== undefined) search.category = filters.category;
  if (filters.q !== DEFAULT_CATALOG_FILTERS.q) search.q = filters.q;
  return search;
}
