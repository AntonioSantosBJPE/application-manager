import type { ResumeSection } from '@am/contracts';
import { Button, FormPage } from '@am/ui';
import { ChevronDown, Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import type { ItemOf } from '../api/server-functions';
import type { CachedItemOf } from '../model/items';
import { itemHeader } from '../model/item-header';
import { ITEM_MESSAGES } from '../model/messages';

export interface ItemCardProps<S extends ResumeSection> {
  section: S;
  item: CachedItemOf[S];
  /** Whether the item starts open: the first one of a section with bullets does (RES-56). */
  initiallyExpanded?: boolean;
}

/** Experiences and projects carry bullets, so their header expands and collapses (RES-56). */
const hasBullets = (section: ResumeSection) => section === 'experiences' || section === 'projects';

/**
 * One item of a section (RES-49, RES-50, RES-56): the header with the title, the dates in `mono` and the
 * place or link, the pencil that opens its fields, and, for experiences and projects, the header that
 * expands the bullets or collapses them to the chevron "Expandir".
 */
export function ItemCard<S extends ResumeSection>({ section, item, initiallyExpanded = false }: ItemCardProps<S>) {
  const bodyId = useId();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [editing, setEditing] = useState(false);
  const header = itemHeader(section, item as ItemOf[S]);
  const collapsible = hasBullets(section);

  const text = (
    <>
      <span className="text-body-strong">{header.title}</span>
      {header.dates === undefined && header.detail === undefined ? null : (
        <span className="text-caption text-text-muted">
          {header.dates === undefined ? null : <span className="font-mono">{header.dates}</span>}
          {header.dates !== undefined && header.detail !== undefined ? ' · ' : null}
          {header.detail}
        </span>
      )}
    </>
  );

  return (
    <FormPage.Item aria-label={header.title}>
      <FormPage.ItemHeader
        actions={
          <>
            <Button
              intent="ghost"
              size="sm"
              icon={Pencil}
              aria-label={ITEM_MESSAGES.edit(header.title)}
              aria-pressed={editing}
              onClick={() => setEditing((current) => !current)}
            />
            {collapsible && !expanded ? (
              <Button
                intent="ghost"
                size="sm"
                icon={ChevronDown}
                aria-label={ITEM_MESSAGES.expand(header.title)}
                aria-expanded={false}
                aria-controls={bodyId}
                onClick={() => setExpanded(true)}
              />
            ) : null}
          </>
        }
      >
        {collapsible ? (
          <Button
            intent="ghost"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => setExpanded((current) => !current)}
            className="h-auto! min-w-0 flex-col items-start justify-start px-1! py-0.5 text-left font-normal whitespace-normal! text-text!"
          >
            {text}
          </Button>
        ) : (
          text
        )}
      </FormPage.ItemHeader>
      {collapsible && expanded ? (
        <FormPage.ItemBody id={bodyId} role="group" aria-label={ITEM_MESSAGES.bullets(header.title)} />
      ) : null}
    </FormPage.Item>
  );
}
