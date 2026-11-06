import { isCsrfRequestAllowed } from '@tanstack/react-start';
import { describe, expect, it } from 'vitest';
import { csrfOptionsFor } from './csrf';

const publicUrl = 'https://app.example.test';
const options = csrfOptionsFor(() => publicUrl);

type ValidationContext = Parameters<typeof isCsrfRequestAllowed>[1];

/** The context Start hands the middleware for one request. */
function contextFor(headers: Record<string, string>, handlerType: 'serverFn' | 'router' = 'serverFn') {
  const request = new Request('http://web-internal:3000/_serverFn/abc123', {
    method: 'POST',
    headers: new Headers(headers),
  });
  return {
    request,
    pathname: new URL(request.url).pathname,
    context: {},
    next: async () => new Response(null),
    handlerType,
  } as unknown as ValidationContext;
}

function allowed(headers: Record<string, string>): Promise<boolean> {
  return isCsrfRequestAllowed(options as Parameters<typeof isCsrfRequestAllowed>[0], contextFor(headers));
}

describe('csrf rules', () => {
  it('allows a server function call of the same origin', async () => {
    expect(await allowed({ 'sec-fetch-site': 'same-origin' })).toBe(true);
    expect(await allowed({ origin: publicUrl })).toBe(true);
    expect(await allowed({ referer: `${publicUrl}/admin/invitations` })).toBe(true);
  });

  it('refuses a server function call from another origin before reaching the api', async () => {
    for (const origin of ['https://evil.test', 'http://app.example.test', 'https://app.example.test.evil.test']) {
      expect(await allowed({ 'sec-fetch-site': 'cross-site', origin })).toBe(false);
    }
  });

  it('refuses a cross-site request that carries no origin header', async () => {
    expect(await allowed({ 'sec-fetch-site': 'cross-site' })).toBe(false);
  });

  it('refuses a request without origin headers, so a call that never came from a page is not trusted', async () => {
    expect(await allowed({})).toBe(false);
  });

  it('judges server function calls only: a page navigation is left alone', async () => {
    const filter = options.filter as (ctx: ValidationContext) => boolean | Promise<boolean>;

    expect(await filter(contextFor({ 'sec-fetch-site': 'none' }, 'router'))).toBe(false);
    expect(await filter(contextFor({ 'sec-fetch-site': 'cross-site' }, 'serverFn'))).toBe(true);
  });

  it('reads the public url when the request arrives, not when the middleware is built', async () => {
    let current = 'https://first.example.test';
    const late = csrfOptionsFor(() => current);
    const call = { origin: 'https://second.example.test' };
    const judge = (headers: Record<string, string>) =>
      isCsrfRequestAllowed(late as Parameters<typeof isCsrfRequestAllowed>[0], contextFor(headers));

    expect(await judge(call)).toBe(false);
    current = 'https://second.example.test';
    expect(await judge(call)).toBe(true);
  });

  it('compares the origin of the public url, so a trailing slash or a path does not refuse the browser', async () => {
    // `Origin` never carries a path; the variable may, because it is also the base of the invite link.
    for (const configured of [`${publicUrl}/`, `${publicUrl}/admin`, `${publicUrl}/admin/invitations`]) {
      const judge = (headers: Record<string, string>) =>
        isCsrfRequestAllowed(
          csrfOptionsFor(() => configured) as Parameters<typeof isCsrfRequestAllowed>[0],
          contextFor(headers),
        );

      expect(await judge({ origin: publicUrl }), configured).toBe(true);
      expect(await judge({ referer: `${publicUrl}/admin` }), configured).toBe(true);
    }
  });

  it('refuses the same host on another scheme or port, even with a path in the public url', async () => {
    const judge = (headers: Record<string, string>) =>
      isCsrfRequestAllowed(
        csrfOptionsFor(() => `${publicUrl}/admin`) as Parameters<typeof isCsrfRequestAllowed>[0],
        contextFor(headers),
      );

    expect(await judge({ origin: 'http://app.example.test' })).toBe(false);
    expect(await judge({ origin: 'https://app.example.test:444' })).toBe(false);
  });
});
