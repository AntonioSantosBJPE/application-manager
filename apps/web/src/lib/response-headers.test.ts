import { describe, expect, it } from 'vitest';
import { responseHeadersFor, withResponseHeaders } from './response-headers';

describe('responseHeadersFor', () => {
  it('marks every page but /status as no-store, so a private page is never cached (UI-18)', () => {
    for (const path of ['/', '/admin', '/admin/invitations', '/login', '/admin/login', '/invite/token-1']) {
      expect(responseHeadersFor(path)['cache-control']).toBe('no-store');
    }
  });

  it('leaves /status cacheable, so the public status page keeps its previous behaviour (UI-20)', () => {
    expect(responseHeadersFor('/status')).toEqual({});
  });

  it('adds Referrer-Policy no-referrer on the invite link only (UI-17)', () => {
    expect(responseHeadersFor('/invite/token-1')).toEqual({
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    });
    expect(responseHeadersFor('/login')['referrer-policy']).toBeUndefined();
    expect(responseHeadersFor('/')).not.toHaveProperty('referrer-policy');
  });

  it('treats the bare /invite and a trailing slash as the same path', () => {
    expect(responseHeadersFor('/invite')['referrer-policy']).toBe('no-referrer');
    expect(responseHeadersFor('/invite/token-1/')).toEqual(responseHeadersFor('/invite/token-1'));
    expect(responseHeadersFor('/status/')).toEqual({});
  });

  it('does not extend the invite rule to a path that merely starts with the word', () => {
    expect(responseHeadersFor('/invitation')).not.toHaveProperty('referrer-policy');
  });
});

describe('withResponseHeaders', () => {
  it('keeps the status, the body and every Set-Cookie of the response', async () => {
    const original = new Response('rendered page', { status: 201 });
    original.headers.append('set-cookie', 'am_session=first; Path=/; HttpOnly');
    original.headers.append('set-cookie', 'am_theme=dark; Path=/');

    const marked = withResponseHeaders(original, '/invite/token-1');

    expect(marked.status).toBe(201);
    expect(marked.headers.get('cache-control')).toBe('no-store');
    expect(marked.headers.get('referrer-policy')).toBe('no-referrer');
    expect(marked.headers.getSetCookie()).toEqual(['am_session=first; Path=/; HttpOnly', 'am_theme=dark; Path=/']);
    await expect(marked.text()).resolves.toBe('rendered page');
  });

  it('returns the response untouched on /status', () => {
    const original = new Response('status');

    expect(withResponseHeaders(original, '/status')).toBe(original);
    expect(original.headers.get('cache-control')).toBeNull();
  });
});
