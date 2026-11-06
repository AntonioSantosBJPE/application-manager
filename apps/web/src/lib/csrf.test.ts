import { isCsrfRequestAllowed } from '@tanstack/react-start';
import { describe, expect, it } from 'vitest';
import { csrfOptionsFor } from './csrf';

const publicUrl = 'https://app.example.test';
const options = csrfOptionsFor(publicUrl);

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
});
