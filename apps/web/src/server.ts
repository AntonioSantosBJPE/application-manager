import handler, { createServerEntry } from '@tanstack/react-start/server-entry';
import { loadServerEnv } from './lib/env';

// Fail at startup, not on the first request, when a required variable is missing (SKEL-11).
try {
  loadServerEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
