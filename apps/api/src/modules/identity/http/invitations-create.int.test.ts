import { describe, expect, inject, it } from 'vitest';
import type { CreateInvitationResponse } from '@am/contracts';
import { createInvitationResponseSchema } from '@am/contracts';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { hashToken } from '../domain/tokens.js';
import { createMigratedDatabase, dropDatabase, query } from '../../../../test/database.js';
import { startApi } from '../../../../test/api.js';

const password = 'correct-horse-battery';
const webPublicUrl = 'https://app.example.com';

async function createUser(databaseUrl: string, email: string, role: 'admin' | 'member'): Promise<string> {
  const [row] = await query<{ id: string }>(
    databaseUrl,
    'insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id',
    [email, role === 'admin' ? 'Admin' : 'Ana', await argon2idPasswordHasher.hash(password), role],
  );
  return row!.id;
}

/** A live session, obtained the way a browser does: through the entrance of its role. */
async function signIn(baseUrl: string, email: string, role: 'admin' | 'member'): Promise<string> {
  const response = await fetch(`${baseUrl}${role === 'admin' ? '/auth/admin/login' : '/auth/login'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(204);
  return /^am_session=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')![1]!;
}

function invite(baseUrl: string, body: unknown, token?: string) {
  return fetch(`${baseUrl}/invitations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token === undefined ? {} : { cookie: `am_session=${token}` }) },
    body: JSON.stringify(body),
  });
}

async function invitationRows(databaseUrl: string, email: string) {
  return query<{ id: string; email: string; invited_by: string; expires_at: Date; revoked_at: Date | null; token_hash: string }>(
    databaseUrl,
    'select id, email, invited_by, expires_at, revoked_at, token_hash from identity.invitations where email = $1 order by id',
    [email],
  );
}

describe('POST /invitations', () => {
  let database: Awaited<ReturnType<typeof createMigratedDatabase>>;
  let adminId: string;
  let memberId: string;
  let adminToken: string;
  let memberToken: string;

  async function setup() {
    database = await createMigratedDatabase(inject('databaseUrl'), 'invite_create');
    adminId = await createUser(database.url, 'admin.invite@example.com', 'admin');
    memberId = await createUser(database.url, 'member.invite@example.com', 'member');
    const api = await startApi(database.url, { webPublicUrl });
    adminToken = await signIn(api.baseUrl, 'admin.invite@example.com', 'admin');
    memberToken = await signIn(api.baseUrl, 'member.invite@example.com', 'member');
    return api;
  }

  it('answers 201 with a 7-day invitation and a url from WEB_PUBLIC_URL', async () => {
    const api = await setup();
    try {
      const response = await invite(api.baseUrl, { email: 'novo.invite@example.com' }, adminToken);
      const body = createInvitationResponseSchema.parse(await response.json());

      expect(response.status).toBe(201);
      // The contract is exactly the link and its expiry; the token exists only inside the link (INV-01).
      expect(Object.keys(body).sort()).toEqual(['expiresAt', 'inviteUrl']);
      expect(body.inviteUrl).toMatch(/^https:\/\/app\.example\.com\/invite\/[A-Za-z0-9_-]{43}$/);
      // Seven days, from the clock the API uses, not from Postgres.
      const [row] = await invitationRows(database.url, 'novo.invite@example.com');
      expect(row!.expires_at.toISOString()).toBe(body.expiresAt);
      expect(new Date(body.expiresAt).getTime() - Date.now()).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
      expect(new Date(body.expiresAt).getTime() - Date.now()).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);

      // The row keeps the hash of the token in the link and nothing of the token itself.
      const token = body.inviteUrl.split('/').at(-1)!;
      expect(row!.token_hash).toBe(hashToken(token));
      expect(JSON.stringify(row)).not.toContain(token);
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });

  it('answers 403 to a member and creates nothing', async () => {
    const api = await setup();
    try {
      const response = await invite(api.baseUrl, { email: 'blocked.invite@example.com' }, memberToken);

      expect(response.status).toBe(403);
      expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      expect(await invitationRows(database.url, 'blocked.invite@example.com')).toEqual([]);
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });

  it('answers 409 for an email that has an account', async () => {
    const api = await setup();
    try {
      // An existing account in either role: the address is taken, so no invitation can be opened.
      for (const email of ['member.invite@example.com', 'admin.invite@example.com']) {
        const response = await invite(api.baseUrl, { email }, adminToken);

        expect({ email, status: response.status }).toEqual({ email, status: 409 });
        expect(await invitationRows(database.url, email)).toEqual([]);
      }
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });

  it('revokes the previous pending invitation of the email', async () => {
    const api = await setup();
    try {
      const email = 'repeat.invite@example.com';
      const first = createInvitationResponseSchema.parse(await (await invite(api.baseUrl, { email }, adminToken)).json());
      const second = await invite(api.baseUrl, { email }, adminToken);
      const body: CreateInvitationResponse = createInvitationResponseSchema.parse(await second.json());

      expect(second.status).toBe(201);
      const rows = await invitationRows(database.url, email);
      // Two rows: the old invitation is revoked, so only the new link works (INV-04).
      expect(rows).toHaveLength(2);
      const [old, current] = rows;
      expect(old!.revoked_at).not.toBeNull();
      expect(current!.revoked_at).toBeNull();
      expect(current!.token_hash).toBe(hashToken(body.inviteUrl.split('/').at(-1)!));
      expect(current!.token_hash).not.toBe(hashToken(first.inviteUrl.split('/').at(-1)!));
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });

  it('takes invited_by from the session and ignores client ids', async () => {
    const api = await setup();
    try {
      // `invitedBy` and `userId` in the body are not part of the contract; they must change nothing (AUTH-16).
      const response = await invite(
        api.baseUrl,
        { email: 'forced.invite@example.com', invitedBy: memberId, userId: memberId },
        adminToken,
      );

      expect(response.status).toBe(201);
      const [row] = await invitationRows(database.url, 'forced.invite@example.com');
      expect(row!.invited_by).toBe(adminId);
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });

  it('normalizes the email before storing it', async () => {
    const api = await setup();
    try {
      const response = await invite(api.baseUrl, { email: '  Novo.Maiusculo@Example.COM ' }, adminToken);

      expect(response.status).toBe(201);
      // Stored lowercased without spaces, so the same person cannot be invited twice with two spellings (EDGE-01).
      const rows = await invitationRows(database.url, 'novo.maiusculo@example.com');
      expect(rows).toHaveLength(1);
    } finally {
      await api.close();
      await dropDatabase(inject('databaseUrl'), database);
    }
  });
});
