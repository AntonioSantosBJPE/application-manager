import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import type { ServerMiddleware } from 'srvx';
import { hideInvitationToken } from './lib/access-log';
import { loadServerEnv } from './lib/env';
import { withResponseHeaders } from './lib/response-headers';

// Fail at startup, not on the first request, when a required variable is missing (SKEL-11).
try {
  loadServerEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

/**
 * Every page leaves through here, so the headers of a path do not depend on which route rendered it or
 * whether it was SSR, a client navigation or a redirect: authenticated pages are never cached and the
 * invite link never leaks as a referrer (UI-17, UI-18).
 */
export default createServerEntry({
  async fetch(request) {
    const response = await handler.fetch(request);
    return withResponseHeaders(response, new URL(request.url).pathname, process.env.APP_VERSION);
  },
});

/**
 * The middleware of the runner, exported from the server entry because that is where the runtime reads
 * it: the access log prints the URL it finds once the handler answers, and the token of an invite link
 * must not reach it (AUTH-18).
 */
export const middleware: ServerMiddleware[] = [hideInvitationToken()];
