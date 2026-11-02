import { randomUUID } from 'node:crypto';

const acceptedRequestId = /^[A-Za-z0-9._-]{1,128}$/;

/** Reuses a well-formed `x-request-id` (LOG-02); anything else gets a new UUID (LOG-03). */
export function resolveRequestId(header: string | string[] | undefined): string {
  return typeof header === 'string' && acceptedRequestId.test(header) ? header : randomUUID();
}
