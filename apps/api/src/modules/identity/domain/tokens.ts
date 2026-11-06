import { createHash, randomBytes } from 'node:crypto';

/** 32 bytes of CSPRNG: 256 bits of entropy, which makes a fast hash enough (AUTH-06). */
const TOKEN_BYTES = 32;

/** An opaque token for a session or an invitation, in base64url so it can travel in a URL. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** What the database keeps: the SHA-256 of the token in hex. The token itself is never stored (AUTH-06). */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
