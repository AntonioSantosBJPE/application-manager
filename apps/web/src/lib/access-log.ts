import type { ServerMiddleware } from 'srvx';

/**
 * The token of an invite link, which is a credential: whoever reads it creates the account (AUTH-18).
 * The token sits in the path, and the URL may arrive relative (`/invite/x`) or absolute (`http://host/invite/x`).
 */
const invitationPath = /(\/invite\/)([^/?#]+)/;

/** The URL with the invite token replaced: `http://host/invite/abc?x=1` becomes `http://host/invite/[token]?x=1`. */
export function withoutInvitationToken(url: string): string {
  return url.replace(invitationPath, '$1[token]');
}

/**
 * The access log of the runner prints the URL of every request as it arrived, and an invite link carries
 * the invitation token in its path. The URL is read again once the handler has answered, so rewriting it
 * with the redacted form keeps the token out of the log; the page itself is untouched, because nothing
 * else reads the request afterwards (AUTH-18).
 */
export function hideInvitationToken(): ServerMiddleware {
  return async (request, next) => {
    const response = await next();
    const redacted = withoutInvitationToken(request.url);
    if (redacted !== request.url) {
      // The runtime exposes `url` as a getter, so an own property shadows it for whoever reads it next.
      Object.defineProperty(request, 'url', { configurable: true, enumerable: true, value: redacted });
    }
    return response;
  };
}
