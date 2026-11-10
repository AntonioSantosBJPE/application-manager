import { PROFILE_LINKS_MAX, saveProfileRequestSchema, type Profile, type ProfileLink } from '@am/contracts';
import { Button, Field } from '@am/ui';
import { Plus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useAutosaveField } from '../hooks/use-autosave-field';
import type { useProfileSave } from '../hooks/use-profile-save';
import { messageFor } from '../model/field-errors';
import { LINK_MESSAGES } from '../model/messages';

interface Row {
  key: number;
  label: string;
  url: string;
  /** The row was just added, so the focus goes to its first field. */
  fresh: boolean;
}

const sameLinks = (a: ProfileLink[], b: ProfileLink[]) =>
  a.length === b.length && a.every((link, i) => link.label === b[i]!.label && link.url === b[i]!.url);

/** Only a row with both fields filled is a link; a half-filled row waits on the screen (RES-46). */
const linksOf = (rows: Row[]): ProfileLink[] =>
  rows
    .map((row) => ({ label: row.label.trim(), url: row.url.trim() }))
    .filter((link) => link.label !== '' && link.url !== '');

/**
 * The links of the profile (RES-46, RES-84): "+ Link" adds a row with "Rótulo" and "URL" that is saved when
 * both are filled and one of them is left, and the "×" of a row removes the link and saves. The profile
 * has up to five links, and "+ Link" stops there.
 */
export function LinksField({ profile, save }: { profile: Profile; save: ReturnType<typeof useProfileSave> }) {
  const titleId = useId();
  const nextKey = useRef(profile.links.length);
  const [rows, setRows] = useState<Row[]>(() =>
    profile.links.map((link, key) => ({ key, label: link.label, url: link.url, fresh: false })),
  );

  const field = useAutosaveField<ProfileLink[]>({
    saved: profile.links,
    equals: sameLinks,
    validate: (links) => messageFor(saveProfileRequestSchema, { ...profile, links }, (path) => path[0] === 'links'),
    save: (links) => save({ links }),
  });

  const change = (key: number, part: 'label' | 'url', value: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [part]: value, fresh: false } : row)));
  const add = () => {
    const key = nextKey.current++;
    setRows((current) => [...current, { key, label: '', url: '', fresh: true }]);
  };
  const remove = (key: number) => {
    const next = rows.filter((row) => row.key !== key);
    setRows(next);
    void field.commit(linksOf(next));
  };

  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span id={titleId} className="text-label text-text">
          {LINK_MESSAGES.title}
        </span>
        <Button intent="secondary" size="sm" icon={Plus} disabled={rows.length >= PROFILE_LINKS_MAX} onClick={add}>
          {LINK_MESSAGES.add}
        </Button>
      </div>
      {rows.map((row, index) => (
        <div
          key={row.key}
          role="group"
          aria-label={LINK_MESSAGES.row(index + 1)}
          className="flex flex-col gap-2 md:flex-row md:items-center"
        >
          <Field.Root className="md:w-40">
            <Field.Control
              aria-label={LINK_MESSAGES.label}
              placeholder={LINK_MESSAGES.label}
              value={row.label}
              autoFocus={row.fresh}
              onChange={(event) => change(row.key, 'label', event.target.value)}
              onBlur={() => void field.commit(linksOf(rows))}
            />
          </Field.Root>
          <Field.Root className="md:flex-1">
            <Field.Control
              aria-label={LINK_MESSAGES.url}
              placeholder={LINK_MESSAGES.url}
              value={row.url}
              onChange={(event) => change(row.key, 'url', event.target.value)}
              onBlur={() => void field.commit(linksOf(rows))}
            />
          </Field.Root>
          <Button
            intent="ghost"
            size="sm"
            icon={X}
            aria-label={LINK_MESSAGES.remove(index + 1)}
            onClick={() => remove(row.key)}
          />
        </div>
      ))}
      {field.error === null ? null : (
        <p role="alert" className="text-caption text-danger">
          {field.error}
        </p>
      )}
    </div>
  );
}
