import type { AdminSkill } from '@am/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { loadAdminSkills, patchSkill, promoteSkillById } from '../api/server-functions';
import { SkillsCatalog } from '../components/SkillsCatalog';
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from '../model/filters';
import { context } from './api';
import { uuid } from './fake-api';

export const alfa: AdminSkill = {
  id: uuid(1),
  name: 'Skill Fictícia Alfa',
  category: 'language',
  scope: 'global',
  aliases: [{ id: uuid(11), alias: 'alfa' }],
};
export const beta: AdminSkill = {
  id: uuid(2),
  name: 'Skill Fictícia Beta',
  category: 'database',
  scope: 'global',
  aliases: [],
};
export const drizzle: AdminSkill = {
  id: uuid(3),
  name: 'Drizzle ORM de Teste',
  category: 'tool',
  scope: 'private',
  aliases: [],
};

/** The catalog the way the route holds it: the filters live outside it and come back through `onFiltersChange`. */
function Harness({
  initial,
  onChange,
  onExpired,
}: {
  initial: CatalogFilters;
  onChange: (filters: CatalogFilters) => void;
  onExpired: (outcome: unknown) => boolean;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <SkillsCatalog
      filters={filters}
      onFiltersChange={(next) => {
        onChange(next);
        setFilters(next);
      }}
      onExpired={onExpired}
      api={{
        list: (current, cursor) =>
          loadAdminSkills(
            {
              scope: current.scope,
              category: current.category,
              q: current.q === '' ? undefined : current.q,
              cursor,
            },
            context,
          ),
        promote: (id) => promoteSkillById(id, context),
        update: (id, body) => patchSkill(id, body, context),
      }}
    />
  );
}

export function renderCatalog(options: {
  filters?: CatalogFilters;
  onExpired?: (outcome: unknown) => boolean;
} = {}) {
  const client = new QueryClient();
  const onExpired = vi.fn(options.onExpired ?? (() => false));
  const onFiltersChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <Harness
        initial={options.filters ?? DEFAULT_CATALOG_FILTERS}
        onChange={onFiltersChange}
        onExpired={onExpired}
      />
    </QueryClientProvider>,
  );
  return { onExpired, onFiltersChange };
}

/** The rows of the list, once the catalog has loaded. */
export const rows = async () => within(await screen.findByRole('list', { name: 'Skills' })).getAllByRole('listitem');


export const rowOf = (name: string) => screen.getByText(name).closest('li')!;

export const global_ = (n: number, name: string, category: AdminSkill['category']): AdminSkill => ({
  id: uuid(n),
  name,
  category,
  scope: 'global',
  aliases: [],
});

/** Opens the "⋯" menu of a global row with Enter and chooses one of its items. */
export function chooseFromMenu(skillName: string, item: 'Editar' | 'Apelidos') {
  fireEvent.keyDown(within(rowOf(skillName)).getByRole('button', { name: `Ações de ${skillName}` }), {
    key: 'Enter',
  });
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
}
