import {
  createItemRequestSchemas,
  updateItemRequestSchemas,
  type MasterResume,
  type ResumeSection,
} from '@am/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useRef, useState } from 'react';
import type { CreateItemBodies, ItemOf, UpdateItemBodies } from '../api/server-functions';
import type { Outcome } from '../../../lib/bff';
import { fieldMessages, FIELD_MESSAGES } from '../model/field-errors';
import { bodyOf, changedBody, ENDING_LABELS, valuesOf, type ItemValues } from '../model/item-fields';
import type { CachedItemOf } from '../model/items';
import { RESUME_MESSAGES } from '../model/messages';
import { RESUME_QUERY_KEY } from './resume-query-key';
import { SavedAtContext } from './saved-at';

/** What an item needs from the BFF; the route binds the server functions, a test binds the api. */
export interface ItemsApi {
  createItem: <S extends ResumeSection>(section: S, body: CreateItemBodies[S]) => Promise<Outcome<ItemOf[S]>>;
  updateItem: <S extends ResumeSection>(section: S, id: string, body: UpdateItemBodies[S]) => Promise<Outcome<ItemOf[S]>>;
}

export interface ItemFormOptions<S extends ResumeSection> {
  section: S;
  /** The saved item; absent for a new one, which is only written once its required fields are valid (RES-52). */
  item?: CachedItemOf[S];
  api: ItemsApi;
  onExpired: (outcome: Outcome<unknown>) => boolean;
  /** Called with the id when a new item was written, so the page keeps showing the same card (RES-53). */
  onCreated?: (id: string) => void;
}

export interface ItemForm {
  values: ItemValues;
  setValue: (name: string, value: string) => void;
  /** A field was left (or a choice made): validates and saves what changed. `next` is the value that was just set. */
  leave: (name: string, next?: Record<string, string>) => Promise<void>;
  /** The message under each field that cannot be sent or failed to save. */
  errors: Record<string, string>;
  /** A new item whose required fields are not valid yet says so (RES-52). */
  needsRequired: boolean;
}

/** The empty required fields stay quiet while a new item is being filled: only the hint talks. */
function quiet(errors: Record<string, string>, values: ItemValues): Record<string, string> {
  const shown: Record<string, string> = {};
  for (const [name, message] of Object.entries(errors)) {
    if ((values[name] ?? '').trim() !== '') shown[name] = message;
  }
  return shown;
}

/**
 * The fields of one item (RES-51 to RES-55, RES-59). A saved item writes what changed when a field is left
 * (a `PATCH`, RES-54, RES-45); a new one writes nothing until every required field is valid, then creates the
 * item (a `POST`, RES-53) and from then on works as a saved one. Writes of one item run one at a time: a field
 * left while the `POST` is in flight waits for the id and goes out as a `PATCH` (no duplicate item), and a field
 * left while a `PATCH` is in flight goes out after it, with the newest values.
 */
export function useItemForm<S extends ResumeSection>({
  section,
  item,
  api,
  onExpired,
  onCreated,
}: ItemFormOptions<S>): ItemForm {
  const queryClient = useQueryClient();
  const { markSaved } = useContext(SavedAtContext);
  const [values, setValues] = useState<ItemValues>(() => valuesOf(section, item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [needsRequired, setNeedsRequired] = useState(item === undefined);

  const latest = useRef(values);
  const saved = useRef<ItemValues>(valuesOf(section, item));
  const id = useRef<string | undefined>(item?.id);
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef<string | null>(null);

  const setValue = useCallback((name: string, value: string) => {
    latest.current = { ...latest.current, [name]: value };
    setValues(latest.current);
  }, []);

  const writeCache = useCallback(
    (write: (resume: MasterResume) => MasterResume) =>
      queryClient.setQueryData<MasterResume>(RESUME_QUERY_KEY, (resume) => (resume === undefined ? resume : write(resume))),
    [queryClient],
  );

  const succeeded = useCallback(() => {
    setErrors({});
    setNeedsRequired(false);
    markSaved();
    return true;
  }, [markSaved]);

  /** Whatever the api says, the field says the same pt-BR phrase; the value stays where it was typed (RES-48). */
  const failed = useCallback(
    (outcome: Exclude<Outcome<unknown>, { ok: true }>, name: string) => {
      onExpired(outcome);
      setErrors({ [name]: RESUME_MESSAGES.saveFailed });
      return false;
    },
    [onExpired],
  );

  /** One write of what the form holds now; answers whether it went through, so a waiting one may follow. */
  const write = useCallback(
    async (from: string): Promise<boolean> => {
      const now = latest.current;
      const noEnd = ENDING_LABELS[section] !== undefined && now.current !== '1' && (now.endDate ?? '').trim() === '';
      const endMissing: Record<string, string> = noEnd ? { endDate: FIELD_MESSAGES.month } : {};

      if (id.current === undefined) {
        const body = bodyOf(section, now);
        const found = { ...fieldMessages(createItemRequestSchemas[section], body), ...endMissing };
        const incomplete = Object.keys(found).length > 0;
        setErrors(quiet(found, now));
        setNeedsRequired(incomplete);
        if (incomplete) return false;
        const outcome = await call(() => api.createItem(section, body as CreateItemBodies[S]));
        if (!outcome.ok) return failed(outcome, from);
        id.current = outcome.data.id;
        saved.current = valuesOf(section, outcome.data as CachedItemOf[S]);
        const created = outcome.data as ItemOf[S];
        writeCache((resume) => ({
          ...resume,
          [section]: [withBullets(section, created), ...(resume[section] as { id: string }[])],
        }));
        onCreated?.(outcome.data.id);
        return succeeded();
      }

      const patch = changedBody(section, now, saved.current);
      const found = { ...fieldMessages(updateItemRequestSchemas[section], patch), ...endMissing };
      if (Object.keys(found).length > 0) {
        setErrors(found);
        return false;
      }
      if (Object.keys(patch).length === 0) {
        setErrors({});
        return false;
      }
      const outcome = await call(() => api.updateItem(section, id.current!, patch as UpdateItemBodies[S]));
      if (!outcome.ok) return failed(outcome, from);
      saved.current = valuesOf(section, outcome.data as CachedItemOf[S]);
      const updated = outcome.data as ItemOf[S];
      writeCache((resume) => ({
        ...resume,
        [section]: (resume[section] as { id: string }[]).map((existing) =>
          existing.id === updated.id ? { ...existing, ...updated } : existing,
        ),
      }));
      return succeeded();
    },
    [api, failed, onCreated, section, succeeded, writeCache],
  );

  const leave = useCallback(
    (name: string, next?: Record<string, string>): Promise<void> => {
      if (next !== undefined) {
        latest.current = { ...latest.current, ...next };
        setValues(latest.current);
      } else {
        const trimmed = (latest.current[name] ?? '').trim();
        if (trimmed !== latest.current[name]) setValue(name, trimmed);
      }
      if (inFlight.current !== null) {
        again.current = name;
        return inFlight.current;
      }
      const run = async () => {
        let from = name;
        for (;;) {
          again.current = null;
          const wrote = await write(from);
          if (!wrote || again.current === null) break;
          from = again.current;
        }
      };
      inFlight.current = run().finally(() => {
        inFlight.current = null;
      });
      return inFlight.current;
    },
    [setValue, write],
  );

  return { values, setValue, leave, errors, needsRequired };
}

/** An api that throws is as unavailable as one that does not answer. */
async function call<T>(run: () => Promise<Outcome<T>>): Promise<Outcome<T>> {
  try {
    return await run();
  } catch {
    return { ok: false, status: 503 };
  }
}

/** A new experience or project enters the cache with the empty bullet list the cache holds for it. */
function withBullets<S extends ResumeSection>(section: S, item: ItemOf[S]): unknown {
  return section === 'experiences' || section === 'projects' ? { ...item, bullets: [] } : item;
}
