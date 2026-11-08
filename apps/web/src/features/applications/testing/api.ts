import { HttpResponse } from 'msw';
import type { ApiRequestContext } from '../../../lib/call-api';

/** Where the tests put the api; every screen test talks to it through MSW, never through a mock of the BFF. */
export const apiInternalUrl = 'http://api.test';

export const context: ApiRequestContext = {
  apiInternalUrl,
  requestId: 'req-1',
  cookie: undefined,
  clientIp: undefined,
};

/** An error as the api sends it: RFC 9457 Problem Details. */
export function problem(status: number, errors?: { path: string; code: string }[]) {
  return HttpResponse.json({ type: 'about:blank', title: `Problem ${status}`, status, ...(errors === undefined ? {} : { errors }) }, { status });
}
