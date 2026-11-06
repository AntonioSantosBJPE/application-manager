import { createStart } from '@tanstack/react-start';
import { csrfMiddlewareFor } from './lib/csrf';
import { loadServerEnv } from './lib/env';

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddlewareFor(loadServerEnv().webPublicUrl)],
}));
