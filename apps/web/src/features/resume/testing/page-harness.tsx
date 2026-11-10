import type { MasterResume } from '@am/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import type { Outcome } from '../../../lib/bff';
import {
  loadResume,
  patchBullet,
  patchResumeItem,
  postBullet,
  postResumeItem,
  putProfile,
  removeBullet,
  removeResumeItem,
} from '../api/server-functions';
import { ResumePage } from '../components/ResumePage';
import type { SkillsFieldApi } from '../../skills';
import type { PageSection } from '../model/sections';
import { context } from './api';

/** The page the way the route holds it: the section lives outside it and comes back through `onSectionChange`. */
function Harness({
  outcome,
  initial,
  onSectionChange,
  onExpired,
  skills,
}: {
  outcome: Outcome<MasterResume>;
  skills: SkillsFieldApi;
  initial: PageSection;
  onSectionChange: (section: PageSection) => void;
  onExpired: (outcome: Outcome<unknown>) => boolean;
}) {
  const [section, setSection] = useState(initial);
  return (
    <ResumePage
      outcome={outcome}
      section={section}
      api={{
        load: () => loadResume(context),
        saveProfile: (body) => putProfile(body, context),
        createItem: (section, body) => postResumeItem(section, body, context),
        updateItem: (section, id, body) => patchResumeItem(section, id, body, context),
        deleteItem: (section, id) => removeResumeItem(section, id, context),
        createBullet: (section, id, body) => postBullet(section, id, body, context),
        updateBullet: (section, id, bulletId, body) => patchBullet(section, id, bulletId, body, context),
        deleteBullet: (section, id, bulletId) => removeBullet(section, id, bulletId, context),
        skills,
      }}
      onSectionChange={(next) => {
        onSectionChange(next);
        setSection(next);
      }}
      onExpired={onExpired}
    />
  );
}

/** A skills api for tests that do not touch the field of skills: it finds nothing and creates nothing. */
const NO_SKILLS: SkillsFieldApi = {
  search: () => Promise.resolve({ ok: true, data: [] }),
  create: () => Promise.resolve({ ok: false, status: 503 }),
};

/** Renders the page over an api answered by MSW (`fakeResume`), with the loader's `outcome` given. */
export function renderResumePage(
  options: { outcome?: Outcome<MasterResume>; resume?: MasterResume; section?: PageSection; skills?: SkillsFieldApi } = {},
) {
  const outcome = options.outcome ?? { ok: true, data: options.resume! };
  const onSectionChange = vi.fn();
  const onExpired = vi.fn(() => false);
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <Harness outcome={outcome} skills={options.skills ?? NO_SKILLS} initial={options.section ?? 'profile'} onSectionChange={onSectionChange} onExpired={onExpired} />
    </QueryClientProvider>,
  );
  return { onSectionChange, onExpired, queryClient };
}
