import { createCsrfMiddleware, type CsrfMiddlewareOptions } from '@tanstack/react-start';

/** The origin of the public url, with any trailing `/` or path removed, or undefined when it is not a url. */
function originOf(webPublicUrl: string): string | undefined {
  try {
    return new URL(webPublicUrl).origin;
  } catch {
    return undefined;
  }
}

/**
 * The rules the CSRF middleware applies. Only server function calls are judged, because a page
 * navigation carries `Sec-Fetch-Site: none` and is not a cross-site write. The allowed origin is
 * `WEB_PUBLIC_URL` rather than the request's own origin, because the request reaches the web through
 * the proxy while the browser's origin is the public one. A POST from another origin is refused before
 * any handler runs, so the api is never called for it (UI-19).
 *
 * The url comes from a getter because `src/start.ts` is bundled for the browser too: the environment is
 * only readable on the server, and the matcher only runs there. `Origin` carries no path, so the url is
 * reduced to its origin before comparing: `https://app.test/` and `https://app.test/base` are the same.
 */
export function csrfOptionsFor(webPublicUrl: () => string): CsrfMiddlewareOptions {
  return {
    filter: (ctx) => ctx.handlerType === 'serverFn',
    origin: (value: string) => value === originOf(webPublicUrl()),
  };
}

/** The middleware built from those rules; the return type is the one `createCsrfMiddleware` declares. */
export function csrfMiddlewareFor(webPublicUrl: () => string): ReturnType<typeof createCsrfMiddleware> {
  return createCsrfMiddleware(csrfOptionsFor(webPublicUrl));
}
