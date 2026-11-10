import type { MasterResume } from '@am/contracts';
import { Alert, AppShell, Button, FormPage } from '@am/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import type { Outcome } from '../../../lib/bff';
import { RESUME_QUERY_KEY } from '../hooks/resume-query-key';
import type { ProfileApi } from '../hooks/use-profile-save';
import { SavedAtProvider } from '../hooks/saved-at';
import { RESUME_MESSAGES } from '../model/messages';
import { SECTION_LABELS, type PageSection } from '../model/sections';
import { ItemsSection } from './ItemsSection';
import { ProfileSection } from './ProfileSection';
import { ResumeIndex } from './ResumeIndex';
import { SavedAt } from './SavedAt';

/** What the page needs from the BFF; the route binds the server function, a test binds the api. */
export interface ResumePageApi extends ProfileApi {
  load: () => Promise<Outcome<MasterResume>>;
}

export interface ResumePageProps {
  /** What the loader read; the cache `['resume']` starts from it (Data Reads: the page reads nothing else). */
  outcome: Outcome<MasterResume>;
  section: PageSection;
  api: ResumePageApi;
  onSectionChange: (section: PageSection) => void;
  /** Gets every failed outcome first; returns true when it was a `401` and the login is opening. */
  onExpired: (outcome: Outcome<unknown>) => boolean;
}

/** A read that failed; `expired` is the `401` the redirect to the login already answers. */
class ReadFailure extends Error {
  constructor(readonly expired: boolean) {
    super('the resume could not be read');
  }
}

/** The page frame: the topbar edge to edge, then the index and the sections with the page's padding. */
function Frame({ children, indexed = false }: { children: ReactNode; indexed?: boolean }) {
  return (
    <FormPage.Root className="gap-0! p-0! md:flex-col! md:flex-nowrap! md:px-0!">
      <AppShell.Topbar>
        <h1 className="text-body font-medium">{RESUME_MESSAGES.title}</h1>
        <SavedAt />
      </AppShell.Topbar>
      <div
        className={
          indexed
            ? 'flex flex-col gap-8 px-6 py-6 md:flex-row md:flex-wrap md:px-8'
            : 'flex flex-col gap-8 px-6 py-6 md:px-8'
        }
      >
        {children}
      </div>
    </FormPage.Root>
  );
}

/**
 * The master resume page (PageMasterResume): the topbar, the index of sections and the section the address
 * names, one at a time (RES-34, RES-35). The loader's outcome seeds the cache `['resume']`, which every
 * edit changes from the answer of its write. A failed read shows "Tentar de novo", which reads again (RES-40).
 */
export function ResumePage({ outcome, section, api, onSectionChange, onExpired }: ResumePageProps) {
  const queryClient = useQueryClient();

  // The loader's answer is the newest read, so it replaces what the cache holds: before the first paint (so the
  // server render has the page) and again when the loader answers anew.
  useState(() => {
    if (outcome.ok) queryClient.setQueryData(RESUME_QUERY_KEY, outcome.data);
  });
  useEffect(() => {
    if (outcome.ok) queryClient.setQueryData(RESUME_QUERY_KEY, outcome.data);
  }, [outcome, queryClient]);

  const resume = useQuery({
    queryKey: RESUME_QUERY_KEY,
    queryFn: async () => {
      const read = await api.load();
      if (read.ok) return read.data;
      throw new ReadFailure(onExpired(read));
    },
    // Only the retry button reads: the cache is the truth, written by each save.
    enabled: false,
    staleTime: Infinity,
    retry: false,
  });

  const expired = !outcome.ok && outcome.status === 401;
  const retryExpired = resume.error instanceof ReadFailure && resume.error.expired;
  useEffect(() => {
    if (expired) onExpired(outcome);
  }, [expired, onExpired, outcome]);
  if (expired || retryExpired) return null;

  if (resume.data === undefined) {
    return (
      <SavedAtProvider>
        <Frame>
          <Alert
            intent="danger"
            action={
              <Button intent="secondary" size="sm" disabled={resume.isFetching} onClick={() => void resume.refetch()}>
                {RESUME_MESSAGES.retry}
              </Button>
            }
          >
            {RESUME_MESSAGES.loadFailed}
          </Alert>
        </Frame>
      </SavedAtProvider>
    );
  }

  return (
    <SavedAtProvider>
      <Frame indexed>
        <ResumeIndex resume={resume.data} section={section} onSelect={onSectionChange} />
        <FormPage.Content>
          {section === 'profile' ? (
            <FormPage.Section title={SECTION_LABELS.profile}>
              <ProfileSection profile={resume.data.profile} api={api} onExpired={onExpired} />
            </FormPage.Section>
          ) : (
            <ItemsSection section={section} items={resume.data[section]} />
          )}
        </FormPage.Content>
      </Frame>
    </SavedAtProvider>
  );
}
