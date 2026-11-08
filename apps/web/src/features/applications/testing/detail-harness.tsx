import type { ApplicationDetail } from '@am/contracts';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { patchJobPosting, postStatus } from '../api/server-functions';
import { ApplicationDetail as Detail, type ApplicationDetailApi } from '../components/ApplicationDetail';
import { context } from './api';

/** The detail api bound to the BFF functions, so a test talks to the fake api through MSW. */
export function detailApi(): ApplicationDetailApi {
  return {
    changeStatus: (id, status) => postStatus(id, { status }, context),
    updatePosting: (id, body) => patchJobPosting(id, body, context),
  };
}

/** Renders the detail the way the route holds it; `onExpired` and `onChanged` are spies. */
export function renderDetail(application: ApplicationDetail, api: ApplicationDetailApi = detailApi()) {
  const onExpired = vi.fn(() => false);
  const onChanged = vi.fn();
  render(<Detail application={application} api={api} onExpired={onExpired} onChanged={onChanged} />);
  return { onExpired, onChanged };
}
