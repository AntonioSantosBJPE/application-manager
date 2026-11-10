import type { MasterResume, Profile, SaveProfileRequest } from '@am/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import type { Outcome } from '../../../lib/bff';
import { RESUME_QUERY_KEY } from './resume-query-key';

/** What the profile needs from the BFF; the route binds the server function, a test binds the api. */
export interface ProfileApi {
  saveProfile: (body: SaveProfileRequest) => Promise<Outcome<Profile>>;
}

/**
 * The write of one field of the profile. The api takes the whole profile, so each save sends the profile in
 * the cache with the field changed, and the answer replaces the profile in the cache (RES-44). Saves run
 * one after the other: a second field left while the first is in flight waits, so it is built on the
 * profile the first one saved and never writes the old value of that field back.
 */
export function useProfileSave(api: ProfileApi, onExpired: (outcome: Outcome<unknown>) => boolean) {
  const queryClient = useQueryClient();
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  return useCallback(
    (patch: Partial<SaveProfileRequest>): Promise<Outcome<Profile>> => {
      const run = async (): Promise<Outcome<Profile>> => {
        const current = queryClient.getQueryData<MasterResume>(RESUME_QUERY_KEY)?.profile;
        if (current === undefined) return { ok: false, status: 503 };
        let outcome: Outcome<Profile>;
        try {
          outcome = await api.saveProfile({ ...current, ...patch });
        } catch {
          outcome = { ok: false, status: 503 };
        }
        if (outcome.ok) {
          queryClient.setQueryData<MasterResume>(RESUME_QUERY_KEY, (resume) =>
            resume === undefined ? resume : { ...resume, profile: outcome.data },
          );
        } else {
          onExpired(outcome);
        }
        return outcome;
      };
      const result = queue.current.then(run);
      queue.current = result;
      return result;
    },
    [api, onExpired, queryClient],
  );
}
