import { RESUME_ITEMS_MAX, type ResumeSection } from '@am/contracts';
import { Button, FormPage } from '@am/ui';
import { useRef, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import type { ItemsApi } from '../hooks/use-item-form';
import type { CachedItemOf } from '../model/items';
import { ADD_ITEM_LABELS, EMPTY_SECTION_TEXTS, SECTION_LABELS } from '../model/sections';
import { ItemCard } from './ItemCard';

export interface ItemsSectionProps<S extends ResumeSection> {
  section: S;
  items: CachedItemOf[S][];
  api: ItemsApi;
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

/** The new item being filled: its key keeps its card on the screen when it is written and gets an id (RES-53). */
interface Draft {
  key: number;
  id?: string;
}

/**
 * A section of items (experiences, projects, educations, certifications or languages): the title with the
 * "+" that opens an empty item at the top, the items in their saved order and, with none, one sentence
 * (RES-39, RES-51). The "+" stops at 50 items (RES-82); the first item of a section with bullets opens
 * expanded (RES-56). A new item is not written until it is valid, so leaving the page drops it (RES-52).
 */
export function ItemsSection<S extends ResumeSection>({ section, items, api, onExpired }: ItemsSectionProps<S>) {
  const bulletSection = section === 'experiences' || section === 'projects';
  const [draft, setDraft] = useState<Draft | null>(null);
  const nextKey = useRef(0);
  const drafting = draft !== null && draft.id === undefined;

  // One list, so the card of a new item stays the same card when it is written and takes its place among the
  // items: it keeps the draft's key, and shows as an item-less card in the instant before the cache has the item.
  const arrived = draft?.id !== undefined && items.some((item) => item.id === draft.id);
  const rows: { key: string; item?: CachedItemOf[S]; fromDraft?: boolean }[] = [
    ...(draft !== null && !arrived ? [{ key: `draft-${draft.key}` }] : []),
    ...items.map((item) => {
      const fromDraft = draft !== null && draft.id === item.id;
      return { key: fromDraft ? `draft-${draft.key}` : item.id, item, fromDraft };
    }),
  ];

  return (
    <FormPage.Section
      title={SECTION_LABELS[section]}
      actions={
        <Button
          intent="secondary"
          size="sm"
          disabled={items.length >= RESUME_ITEMS_MAX}
          onClick={() => {
            if (drafting) return;
            setDraft({ key: nextKey.current++ });
          }}
        >
          {ADD_ITEM_LABELS[section]}
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="text-text-muted">{EMPTY_SECTION_TEXTS[section]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ key, item, fromDraft }, index) => (
            <li key={key} className="list-none">
              <ItemCard
                section={section}
                item={item}
                api={api}
                onExpired={onExpired}
                initiallyExpanded={item === undefined || fromDraft || (bulletSection && index === 0 && draft === null)}
                onCreated={item === undefined || fromDraft ? (id) => setDraft({ key: draft!.key, id }) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </FormPage.Section>
  );
}
