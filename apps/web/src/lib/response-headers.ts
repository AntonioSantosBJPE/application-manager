/**
 * Response headers the web sets by path, whatever rendered the page, so no route has to remember them.
 * A trailing `/` is the same page, so `/invite/` and `/invite` share the rules.
 */
export function responseHeadersFor(pathname: string, version?: string): Record<string, string> {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  // The build the image was made from, on every page, so a deploy can tell the new version from the old.
  const build: Record<string, string> = version === undefined || version === '' ? {} : { 'x-app-version': version };
  if (path === '/status') return build;

  const headers: Record<string, string> = { ...build, 'cache-control': 'no-store' };
  // The invite link is a secret in the URL, so the browser must never send it as a referrer (UI-17).
  if (path === '/invite' || path.startsWith('/invite/')) headers['referrer-policy'] = 'no-referrer';
  return headers;
}

/**
 * The same response with the path headers applied. The headers are written in place, so the body, the
 * status and the `Set-Cookie` the server function already appended all survive; a response whose
 * headers are immutable gets a copy that keeps each `Set-Cookie`.
 */
export function withResponseHeaders(response: Response, pathname: string, version?: string): Response {
  const extra = Object.entries(responseHeadersFor(pathname, version));
  if (extra.length === 0) return response;
  try {
    for (const [name, value] of extra) response.headers.set(name, value);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [name, value] of extra) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}
