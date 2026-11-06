import { createCsrfMiddleware, type CsrfMiddlewareOptions } from '@tanstack/react-start';

/**
 * The rules the CSRF middleware applies. Only server function calls are judged, because a page
 * navigation carries `Sec-Fetch-Site: none` and is not a cross-site write. The allowed origin is
 * `WEB_PUBLIC_URL` rather than the request's own origin, because the request reaches the web through
 * the proxy while the browser's origin is the public one. A POST from another origin is refused before
 * any handler runs, so the api is never called for it (UI-19).
 */
export function csrfOptionsFor(webPublicUrl: string): CsrfMiddlewareOptions {
  return {
    filter: (ctx) => ctx.handlerType === 'serverFn',
    origin: (value: string) => value === webPublicUrl,
  };
}

/** The middleware built from those rules; the return type is the one `createCsrfMiddleware` declares. */
export function csrfMiddlewareFor(webPublicUrl: string): ReturnType<typeof createCsrfMiddleware> {
  return createCsrfMiddleware(csrfOptionsFor(webPublicUrl));
}
