import { RESUME_ITEMS_MAX, type ResumeSection, type SkillDictionary } from '@am/contracts';
import { Button, FormPage, Sortable } from '@am/ui';
import { useRef, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import type { ResumeApi } from '../hooks/resume-api';
import { useReorder } from '../hooks/use-reorder';
import type { ItemOf } from '../api/server-functions';
import { itemHeader } from '../model/item-header';
import { announcementsFor, ITEM_LIST_LABELS, REORDER_MESSAGES } from '../model/reorder-messages';
import type { CachedItemOf } from '../model/items';
import { ADD_ITEM_LABELS, EMPTY_SECTION_TEXTS, SECTION_LABELS } from '../model/sections';
import { ItemCard } from './ItemCard';

export interface ItemsSectionProps<S extends ResumeSection> {
  section: S;
  items: CachedItemOf[S][];
  skills: SkillDictionary;
  api: ResumeApi;
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
export function ItemsSection<S extends ResumeSection>({ section, items, skills, api, onExpired }: ItemsSectionProps<S>) {
  const bulletSection = section === 'experiences' || section === 'projects';
  const [draft, setDraft] = useState<Draft | null>(null);
  const nextKey = useRef(0);
  const drafting = draft !== null && draft.id === undefined;
  const { reorder, error } = useReorder(section, undefined, api);

  // One list, so the card of a new item stays the same card when it is written and takes its place among the
  // items: it keeps the draft's key, and shows as an item-less card in the instant before the cache has the item.
  const arrived = draft?.id !== undefined && items.some((item) => item.id === draft.id);
  const rows: { key: string; id: string; item?: CachedItemOf[S]; fromDraft?: boolean }[] = [
    ...(draft !== null && !arrived ? [{ key: `draft-${draft.key}`, id: `draft-${draft.key}` }] : []),
    ...items.map((item) => {
      const fromDraft = draft !== null && draft.id === item.id;
      return { key: fromDraft ? `draft-${draft.key}` : item.id, id: item.id, item, fromDraft };
    }),
  ];

  const titleOf = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    return item === undefined ? '' : itemHeader(section, item as ItemOf[S]).title;
  };

  /** The drop gives the order of every row; a new item that is not written yet has no place to save. */
  function drop(ids: string[]) {
    const saved = ids.filter((id) => items.some((item) => item.id === id));
    void reorder(saved).then((outcome) => {
      if (!outcome.ok) onExpired(outcome);
    });
  }

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
        <Sortable.List
          aria-label={ITEM_LIST_LABELS[section]}
          ids={rows.map((row) => row.id)}
          onReorder={drop}
          announcements={announcementsFor(titleOf)}
          instructions={REORDER_MESSAGES.instructions}
          roleDescription={REORDER_MESSAGES.roleDescription}
          className="flex flex-col gap-2"
        >
          {rows.map(({ key, id, item, fromDraft }, index) => (
            <Sortable.Item key={key} id={id}>
              <ItemCard
                section={section}
                item={item}
                skills={skills}
                api={api}
                onExpired={onExpired}
                handle={
                  item === undefined ? undefined : (
                    <Sortable.Handle label={REORDER_MESSAGES.move(itemHeader(section, item as ItemOf[S]).title)} />
                  )
                }
                initiallyExpanded={item === undefined || fromDraft || (bulletSection && index === 0 && draft === null)}
                onCreated={item === undefined || fromDraft ? (created) => setDraft({ key: draft!.key, id: created }) : undefined}
              />
            </Sortable.Item>
          ))}
        </Sortable.List>
      )}
      {error === null ? null : (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </FormPage.Section>
  );
}
