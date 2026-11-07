import { describe, expect, it } from 'vitest';
import { hideInvitationToken, withoutInvitationToken } from './access-log';

/** A stand-in for the token of an invite link: the shape the api generates, with no secret in it. */
const token = 'dummy-invite-token-for-the-test';

describe('withoutInvitationToken', () => {
  it('replaces the token of an invite path and keeps the rest of the url', () => {
    expect(withoutInvitationToken(`/invite/${token}`)).toBe('/invite/[token]');
    expect(withoutInvitationToken(`/invite/${token}?from=mail`)).toBe('/invite/[token]?from=mail');
    expect(withoutInvitationToken(`http://localhost:3000/invite/${token}`)).toBe(
      'http://localhost:3000/invite/[token]',
    );
  });

  it('leaves every other path untouched', () => {
    for (const url of ['/login', '/admin/invitations', '/status', '/invite', '/invited/abc']) {
      expect(withoutInvitationToken(url), url).toBe(url);
    }
  });
});

describe('hideInvitationToken', () => {
  /** A request as the runtime hands it to the middleware: `url` is a getter over the transport. */
  function request(url: string) {
    return Object.defineProperty({}, 'url', { configurable: true, enumerable: true, get: () => url }) as {
      url: string;
    };
  }

  it('hides the token from the url the access log reads after the answer', async () => {
    const req = request(`/invite/${token}`);
    const middleware = hideInvitationToken();

    // The handler sees the real url: the page needs the token to check the invitation.
    const seen: string[] = [];
    const response = await middleware(req as never, async () => {
      seen.push(req.url);
      return new Response(null, { status: 200 });
    });

    expect(seen).toEqual([`/invite/${token}`]);
    expect(response.status).toBe(200);
    expect(req.url).toBe('/invite/[token]');
  });

  it('does nothing to a request that carries no invitation token', async () => {
    const req = request('/login?redirect=%2F');
    await hideInvitationToken()(req as never, async () => new Response(null, { status: 200 }));

    expect(req.url).toBe('/login?redirect=%2F');
  });
});
