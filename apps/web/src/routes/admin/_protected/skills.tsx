import { createFileRoute } from '@tanstack/react-router';
import { useExpiredSessionRedirect } from '../../../features/identity';
import {
  addSkillAlias,
  listAdminSkills,
  parseCatalogSearch,
  promoteSkill,
  removeSkillAlias,
  searchOf,
  SkillsCatalog,
  updateSkill,
  updateSkillAlias,
} from '../../../features/skills';

/** Skills catalog of the admin area: a list page whose filters live in the address (SKL-41). */
export const Route = createFileRoute('/admin/_protected/skills')({
  validateSearch: (raw) => searchOf(parseCatalogSearch(raw)),
  component: SkillsPage,
});

function SkillsPage() {
  const onExpired = useExpiredSessionRedirect();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <SkillsCatalog
      filters={parseCatalogSearch(search)}
      onFiltersChange={(filters) => void navigate({ search: searchOf(filters) })}
      onExpired={onExpired}
      api={{
        list: (filters, cursor) =>
          listAdminSkills({
            data: {
              scope: filters.scope,
              category: filters.category,
              q: filters.q === '' ? undefined : filters.q,
              cursor,
            },
          }),
        promote: (id) => promoteSkill({ data: id }),
        update: (id, body) => updateSkill({ data: { id, body } }),
        addAlias: (id, body) => addSkillAlias({ data: { id, body } }),
        updateAlias: (id, aliasId, body) => updateSkillAlias({ data: { id, aliasId, body } }),
        removeAlias: (id, aliasId) => removeSkillAlias({ data: { id, aliasId } }),
      }}
    />
  );
}
