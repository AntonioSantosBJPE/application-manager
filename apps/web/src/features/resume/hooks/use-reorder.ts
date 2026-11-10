import type { MasterResume, OrderResponse, ResumeSection } from '@am/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import type { Outcome } from '../../../lib/bff';
import { getResume, orderBullets, orderResumeItems, type BulletSection } from '../api/server-functions';
import { RESUME_MESSAGES } from '../model/messages';
import { RESUME_QUERY_KEY } from './resume-query-key';

/** What a reorder needs from the BFF; the screen binds the server functions, a test binds the api. */
export interface ReorderApi {
  orderItems: (section: ResumeSection, ids: string[]) => Promise<Outcome<OrderResponse>>;
  orderBullets: (section: BulletSection, itemId: string, ids: string[]) => Promise<Outcome<OrderResponse>>;
  /** Reads the whole resume again, for the order the api refused (RES-75). */
  load: () => Promise<Outcome<MasterResume>>;
}

/** The server functions, as the browser calls them. */
export const serverReorderApi: ReorderApi = {
  orderItems: (section, ids) => orderResumeItems({ data: { section, ids } }),
  orderBullets: (section, itemId, ids) => orderBullets({ data: { section, id: itemId, ids } }),
  load: () => getResume(),
};

type Listed = { id: string };

/** The list the order is about: the items of a section, or the bullets of one item. */
function listOf(resume: MasterResume, section: ResumeSection, parentId: string | undefined): Listed[] {
  if (parentId === undefined) return resume[section];
  const parent = (resume[section] as { id: string; bullets?: Listed[] }[]).find((item) => item.id === parentId);
  return parent?.bullets ?? [];
}

/** `ids` first, in that order, then whatever the list holds that `ids` does not name, in its own order. */
function ordered<T extends Listed>(list: T[], ids: readonly string[]): T[] {
  const named = ids.flatMap((id) => list.filter((item) => item.id === id));
  return [...named, ...list.filter((item) => !ids.includes(item.id))];
}

/** The resume with the items of the section, or the bullets of the item, in the order `ids` gives. */
function withOrder(resume: MasterResume, section: ResumeSection, parentId: string | undefined, ids: readonly string[]): MasterResume {
  if (parentId === undefined) return { ...resume, [section]: ordered(resume[section] as Listed[], ids) };
  const items = (resume[section] as { id: string; bullets?: Listed[] }[]).map((item) =>
    item.id === parentId && item.bullets !== undefined ? { ...item, bullets: ordered(item.bullets, ids) } : item,
  );
  return { ...resume, [section]: items };
}

export interface Reorder {
  /** Shows `ids` at once, saves the order and answers how it went, so the caller can see a `401`. */
  reorder: (ids: string[]) => Promise<Outcome<OrderResponse>>;
  /** "Não foi possível salvar a nova ordem." after a failure, until the next reorder starts (RES-74). */
  error: string | null;
}

/**
 * The order of a section's items, or of one item's bullets (`parentId`), kept in the cache `['resume']`
 * (RES-70, RES-71). The new order shows before the api answers. A failure puts the list back as it was and
 * says so (RES-74); a `400` means the api holds another order than the screen, so the resume is read again
 * and the saved order shows (RES-75).
 */
export function useReorder(section: ResumeSection, parentId?: string, api: ReorderApi = serverReorderApi): Reorder {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const reorder = useCallback(
    async (ids: string[]): Promise<Outcome<OrderResponse>> => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: RESUME_QUERY_KEY });
      const before = queryClient.getQueryData<MasterResume>(RESUME_QUERY_KEY);
      if (before === undefined) return { ok: false, status: 503 };
      const previous = listOf(before, section, parentId).map((item) => item.id);
      const apply = (list: readonly string[]) =>
        queryClient.setQueryData<MasterResume>(RESUME_QUERY_KEY, (current) =>
          current === undefined ? current : withOrder(current, section, parentId, list),
        );

      apply(ids);
      let outcome: Outcome<OrderResponse>;
      try {
        outcome =
          parentId === undefined
            ? await api.orderItems(section, ids)
            : await api.orderBullets(section as BulletSection, parentId, ids);
      } catch {
        outcome = { ok: false, status: 503 };
      }

      if (outcome.ok) {
        apply(outcome.data.ids);
        return outcome;
      }
      if (outcome.status === 400) {
        const fresh = await api.load().catch((): Outcome<MasterResume> => ({ ok: false, status: 503 }));
        if (fresh.ok) {
          queryClient.setQueryData<MasterResume>(RESUME_QUERY_KEY, fresh.data);
          return outcome;
        }
      }
      apply(previous);
      setError(RESUME_MESSAGES.reorderFailed);
      return outcome;
    },
    [api, parentId, queryClient, section],
  );

  return { reorder, error };
}
