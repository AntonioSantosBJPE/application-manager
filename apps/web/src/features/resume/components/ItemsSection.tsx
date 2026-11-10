import { RESUME_ITEMS_MAX, type ResumeSection } from '@am/contracts';
import { Button, FormPage } from '@am/ui';
import type { CachedItemOf } from '../model/items';
import { ADD_ITEM_LABELS, EMPTY_SECTION_TEXTS, SECTION_LABELS } from '../model/sections';
import { ItemCard } from './ItemCard';

export interface ItemsSectionProps<S extends ResumeSection> {
  section: S;
  items: CachedItemOf[S][];
}

/**
 * A section of items (experiences, projects, educations, certifications or languages): the title with the
 * "+" that adds one, the items in their saved order and, with none, one sentence (RES-39). The "+" stops at
 * 50 items (RES-82); the first item of a section with bullets opens expanded (RES-56).
 */
export function ItemsSection<S extends ResumeSection>({ section, items }: ItemsSectionProps<S>) {
  const bulletSection = section === 'experiences' || section === 'projects';
  return (
    <FormPage.Section
      title={SECTION_LABELS[section]}
      actions={
        <Button intent="secondary" size="sm" disabled={items.length >= RESUME_ITEMS_MAX}>
          {ADD_ITEM_LABELS[section]}
        </Button>
      }
    >
      {items.length === 0 ? (
        <p className="text-text-muted">{EMPTY_SECTION_TEXTS[section]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li key={item.id} className="list-none">
              <ItemCard section={section} item={item} initiallyExpanded={bulletSection && index === 0} />
            </li>
          ))}
        </ul>
      )}
    </FormPage.Section>
  );
}
