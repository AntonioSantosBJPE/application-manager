import { randomUUID } from 'node:crypto';

// Same rule as the api: at most 128 characters of [A-Za-z0-9._-].
const acceptedRequestId = /^[A-Za-z0-9._-]{1,128}$/;

/** Reuses a well-formed incoming `x-request-id`; anything else gets a new UUID. */
export function resolveRequestId(header: string | undefined): string {
  return typeof header === 'string' && acceptedRequestId.test(header) ? header : randomUUID();
}
