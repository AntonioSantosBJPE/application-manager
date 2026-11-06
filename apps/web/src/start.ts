import { createStart } from '@tanstack/react-start';
import { csrfMiddlewareFor } from './lib/csrf';
import { loadServerEnv } from './lib/env';

/**
 * The global request middleware of the app. `src/start.ts` is also part of the client bundle, so the
 * environment is read on demand inside the middleware, which only runs on the server.
 */
export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddlewareFor(() => loadServerEnv().webPublicUrl)],
}));
