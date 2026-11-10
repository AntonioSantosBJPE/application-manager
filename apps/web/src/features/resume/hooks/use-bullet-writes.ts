import type {
  Bullet,
  BulletResponse,
  CreateBulletRequest,
  MasterResume,
  UpdateBulletRequest,
} from '@am/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';
import type { Outcome } from '../../../lib/bff';
import type { BulletSection } from '../api/server-functions';
import { RESUME_QUERY_KEY } from './resume-query-key';
import { SavedAtContext } from './saved-at';

/** What the bullets of an item need from the BFF; the route binds the server functions, a test binds the api. */
export interface BulletsApi {
  createBullet: (section: BulletSection, itemId: string, body: CreateBulletRequest) => Promise<Outcome<BulletResponse>>;
  updateBullet: (
    section: BulletSection,
    itemId: string,
    bulletId: string,
    body: UpdateBulletRequest,
  ) => Promise<Outcome<BulletResponse>>;
  deleteBullet: (section: BulletSection, itemId: string, bulletId: string) => Promise<Outcome<undefined>>;
}

export interface BulletWrites {
  /** Writes a new bullet at the end of the item (RES-62); answers the outcome, so the caller can say how it went. */
  create: (body: CreateBulletRequest) => Promise<Outcome<BulletResponse>>;
  /** Writes the text, the skills or both of a bullet (RES-64, RES-67). */
  update: (bulletId: string, body: UpdateBulletRequest) => Promise<Outcome<BulletResponse>>;
  /** Removes a bullet, with no confirmation (RES-68). */
  remove: (bulletId: string) => Promise<Outcome<undefined>>;
}

/** The resume with the bullets of one item changed by `change`. */
function withBullets(
  resume: MasterResume,
  section: BulletSection,
  itemId: string,
  change: (bullets: Bullet[]) => Bullet[],
): MasterResume {
  return {
    ...resume,
    [section]: (resume[section] as { id: string; bullets: Bullet[] }[]).map((item) =>
      item.id === itemId ? { ...item, bullets: change(item.bullets) } : item,
    ),
  };
}

/**
 * The writes of the bullets of one item. Each answer changes the cache `['resume']`: a bullet written
 * replaces or joins the bullets of its item, and the skills of the answer are merged into the dictionary,
 * one entry per skill (AD-028). A removal drops the bullet. Nothing is read again.
 */
export function useBulletWrites(
  section: BulletSection,
  itemId: string,
  api: BulletsApi,
  onExpired: (outcome: Outcome<unknown>) => boolean,
): BulletWrites {
  const queryClient = useQueryClient();
  const { markSaved } = useContext(SavedAtContext);

  const change = useCallback(
    (write: (resume: MasterResume) => MasterResume) =>
      queryClient.setQueryData<MasterResume>(RESUME_QUERY_KEY, (resume) => (resume === undefined ? resume : write(resume))),
    [queryClient],
  );

  const settle = useCallback(
    async <T>(run: () => Promise<Outcome<T>>): Promise<Outcome<T>> => {
      let outcome: Outcome<T>;
      try {
        outcome = await run();
      } catch {
        outcome = { ok: false, status: 503 };
      }
      if (!outcome.ok) onExpired(outcome);
      return outcome;
    },
    [onExpired],
  );

  const create = useCallback(
    async (body: CreateBulletRequest) => {
      const outcome = await settle(() => api.createBullet(section, itemId, body));
      if (outcome.ok) {
        const { bullet, skills } = outcome.data;
        change((resume) => ({
          ...withBullets(resume, section, itemId, (bullets) => [...bullets, bullet]),
          skills: { ...resume.skills, ...skills },
        }));
        markSaved();
      }
      return outcome;
    },
    [api, change, itemId, markSaved, section, settle],
  );

  const update = useCallback(
    async (bulletId: string, body: UpdateBulletRequest) => {
      const outcome = await settle(() => api.updateBullet(section, itemId, bulletId, body));
      if (outcome.ok) {
        const { bullet, skills } = outcome.data;
        change((resume) => ({
          ...withBullets(resume, section, itemId, (bullets) => bullets.map((b) => (b.id === bullet.id ? bullet : b))),
          skills: { ...resume.skills, ...skills },
        }));
        markSaved();
      }
      return outcome;
    },
    [api, change, itemId, markSaved, section, settle],
  );

  const remove = useCallback(
    async (bulletId: string) => {
      const outcome = await settle(() => api.deleteBullet(section, itemId, bulletId));
      if (outcome.ok) change((resume) => withBullets(resume, section, itemId, (bullets) => bullets.filter((b) => b.id !== bulletId)));
      return outcome;
    },
    [api, change, itemId, section, settle],
  );

  return { create, update, remove };
}
