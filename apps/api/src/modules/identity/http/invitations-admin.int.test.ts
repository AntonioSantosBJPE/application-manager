import { describe, expect, inject, it } from 'vitest';
import type { CreateInvitationResponse, InvitationsPage } from '@am/contracts';
import { createInvitationResponseSchema, invitationsPageSchema } from '@am/contracts';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { hashToken } from '../domain/tokens.js';
import { createMigratedDatabase, dropDatabase, query } from '../../../../test/database.js';
import { startApi } from '../../../../test/api.js';

const password = 'correct-horse-battery';
const webPublicUrl = 'https://app.example.com';

type Api = Awaited<ReturnType<typeof startApi>>;
type Database = Awaited<ReturnType<typeof createMigratedDatabase>>;

async function createUser(databaseUrl: string, email: string, role: 'admin' | 'member'): Promise<string> {
  const [row] = await query<{ id: string }>(
    databaseUrl,
    'insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id',
    [email, role === 'admin' ? 'Admin' : 'Ana', await argon2idPasswordHasher.hash(password), role],
  );
  return row!.id;
}

async function signIn(baseUrl: string, email: string, role: 'admin' | 'member'): Promise<string> {
  const response = await fetch(`${baseUrl}${role === 'admin' ? '/auth/admin/login' : '/auth/login'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(204);
  return /^am_session=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')![1]!;
}

async function invite(baseUrl: string, email: string, adminToken: string): Promise<CreateInvitationResponse> {
  const response = await fetch(`${baseUrl}/invitations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `am_session=${adminToken}` },
    body: JSON.stringify({ email }),
  });
  expect(response.status).toBe(201);
  return createInvitationResponseSchema.parse(await response.json());
}

function listPage(baseUrl: string, token?: string, cursor?: string): Promise<Response> {
  const query = cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`;
  return fetch(`${baseUrl}/invitations${query}`, {
    headers: token === undefined ? {} : { cookie: `am_session=${token}` },
  });
}

function revoke(baseUrl: string, id: string, token?: string): Promise<Response> {
  return fetch(`${baseUrl}/invitations/${id}`, {
    method: 'DELETE',
    headers: token === undefined ? {} : { cookie: `am_session=${token}` },
  });
}

async function withApi(run: (api: Api, database: Database) => Promise<void>) {
  const database = await createMigratedDatabase(inject('databaseUrl'), 'invite_admin');
  const api = await startApi(database.url, { webPublicUrl });
  try {
    await run(api, database);
  } finally {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  }
}

async function withAdmin(api: Api, database: Database): Promise<string> {
  await createUser(database.url, 'admin.list@example.com', 'admin');
  return signIn(api.baseUrl, 'admin.list@example.com', 'admin');
}

async function invitationIdOf(databaseUrl: string, email: string): Promise<string> {
  const [row] = await query<{ id: string }>(databaseUrl, 'select id from identity.invitations where email = $1', [email]);
  return row!.id;
}

describe('GET /invitations', () => {
  it('lists only pending invitations newest first with cursor and total', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);

      const first = await invite(api.baseUrl, 'um.list@example.com', adminToken);
      const second = await invite(api.baseUrl, 'dois.list@example.com', adminToken);
      const third = await invite(api.baseUrl, 'tres.list@example.com', adminToken);
      // One expired, one accepted and one revoked: none of them is pending any more.
      await invite(api.baseUrl, 'expirado.list@example.com', adminToken);
      await invite(api.baseUrl, 'aceito.list@example.com', adminToken);
      await invite(api.baseUrl, 'revogado.list@example.com', adminToken);
      await query(
        database.url,
        "update identity.invitations set expires_at = now() - interval '1 second' where email = 'expirado.list@example.com'",
      );
      await query(
        database.url,
        "update identity.invitations set accepted_at = now() where email = 'aceito.list@example.com'",
      );
      await query(
        database.url,
        "update identity.invitations set revoked_at = now() where email = 'revogado.list@example.com'",
      );

      const response = await listPage(api.baseUrl, adminToken);

      expect(response.status).toBe(200);
      const page: InvitationsPage = invitationsPageSchema.parse(await response.json());
      // Newest first, from the uuid v7 keys: the third invitation was made last (ADM-01).
      expect(page.items.map((item) => item.email)).toEqual([
        'tres.list@example.com',
        'dois.list@example.com',
        'um.list@example.com',
      ]);
      expect(page.totalPending).toBe(3);
      expect(page.nextCursor).toBeNull();
      expect(page.items[0]!.expiresAt).toBe(third.expiresAt);
      expect(page.items[2]!.expiresAt).toBe(first.expiresAt);
      expect(page.items[1]!.id).toBe(await invitationIdOf(database.url, 'dois.list@example.com'));
      expect(page.items[0]!.id).toBe(await invitationIdOf(database.url, 'tres.list@example.com'));
      expect(second.expiresAt).toBe(page.items[1]!.expiresAt);
    });
  });

  it('pages with the cursor and keeps the total across pages', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      // One more than a page, so the first answer offers "Carregar mais" (ADM-13).
      const created: string[] = [];
      for (let i = 1; i <= 21; i += 1) {
        await invite(api.baseUrl, `page-${String(i).padStart(2, '0')}.list@example.com`, adminToken);
        created.push(`page-${String(i).padStart(2, '0')}.list@example.com`);
      }

      const first = invitationsPageSchema.parse(await (await listPage(api.baseUrl, adminToken)).json());
      expect(first.items).toHaveLength(20);
      expect(first.totalPending).toBe(21);
      const cursor = first.nextCursor;
      expect(cursor).toBe(first.items.at(-1)!.id);

      const second = invitationsPageSchema.parse(await (await listPage(api.baseUrl, adminToken, cursor!)).json());
      // The next page starts after the cursor: one invitation left, and its total is still the whole set.
      expect(second.items).toHaveLength(1);
      expect(second.items[0]!.email).toBe(created[0]);
      expect(second.nextCursor).toBeNull();
      expect(second.totalPending).toBe(21);
      // No row appears on both pages.
      expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(21);
    });
  });

  it('never returns a token or its hash', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'segredo.list@example.com', adminToken);
      const token = created.inviteUrl.split('/').at(-1)!;

      const response = await listPage(api.baseUrl, adminToken);
      const text = await response.text();

      // The body carries no token and no hash: the link is only shown by the answer that created it (ADM-05).
      expect(text).not.toContain(token);
      expect(text).not.toContain(hashToken(token));
      const page = invitationsPageSchema.parse(JSON.parse(text));
      expect(Object.keys(page.items[0]!).sort()).toEqual(['email', 'expiresAt', 'id']);
    });
  });
});

describe('DELETE /invitations/:id', () => {
  it('marks revoked_at and answers 204', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'revoga.list@example.com', adminToken);
      const id = await invitationIdOf(database.url, 'revoga.list@example.com');
      const token = created.inviteUrl.split('/').at(-1)!;
      // Control: the link works before the revocation.
      expect((await fetch(`${api.baseUrl}/invitations/${token}`)).status).toBe(200);

      const response = await revoke(api.baseUrl, id, adminToken);

      expect(response.status).toBe(204);
      const [row] = await query<{ revoked_at: Date | null }>(
        database.url,
        'select revoked_at from identity.invitations where id = $1',
        [id],
      );
      expect(row!.revoked_at).not.toBeNull();
      // The revoked link stops working at once (ADM-02).
      expect((await fetch(`${api.baseUrl}/invitations/${token}`)).status).toBe(410);
      // And it leaves the pending list and its total.
      const page = invitationsPageSchema.parse(await (await listPage(api.baseUrl, adminToken)).json());
      expect(page.items).toEqual([]);
      expect(page.totalPending).toBe(0);
    });
  });

  it('answers 404 for an unknown or non-pending invitation', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      await invite(api.baseUrl, 'aceito.del@example.com', adminToken);
      await invite(api.baseUrl, 'revogado.del@example.com', adminToken);
      await query(
        database.url,
        "update identity.invitations set accepted_at = now() where email = 'aceito.del@example.com'",
      );
      await query(
        database.url,
        "update identity.invitations set revoked_at = now() where email = 'revogado.del@example.com'",
      );

      const cases = [
        { name: 'unknown', id: '0199f0f4-0000-7000-8000-000000000000' },
        { name: 'not a uuid', id: 'not-an-id' },
        { name: 'accepted', id: await invitationIdOf(database.url, 'aceito.del@example.com') },
        { name: 'revoked', id: await invitationIdOf(database.url, 'revogado.del@example.com') },
      ];
      for (const attempt of cases) {
        const response = await revoke(api.baseUrl, attempt.id, adminToken);

        expect({ name: attempt.name, status: response.status }).toEqual({ name: attempt.name, status: 404 });
        expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      }

      // Control: a pending one is revoked, so the 404s are about the state and not the route.
      const pending = await invite(api.baseUrl, 'pendente.del@example.com', adminToken);
      expect(pending.inviteUrl).toContain('/invite/');
      const pendingId = await invitationIdOf(database.url, 'pendente.del@example.com');
      expect((await revoke(api.baseUrl, pendingId, adminToken)).status).toBe(204);
    });
  });
});

describe('invitations administration', () => {
  it('answers 403 to a member on list and revoke', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      await invite(api.baseUrl, 'protegido.del@example.com', adminToken);
      const id = await invitationIdOf(database.url, 'protegido.del@example.com');
      await createUser(database.url, 'member.del@example.com', 'member');
      const memberToken = await signIn(api.baseUrl, 'member.del@example.com', 'member');

      const listed = await listPage(api.baseUrl, memberToken);
      const removed = await revoke(api.baseUrl, id, memberToken);

      expect([listed.status, removed.status]).toEqual([403, 403]);
      // The invitation is untouched: a member cannot revoke what an admin invited (ADM-04).
      const [row] = await query<{ revoked_at: Date | null }>(
        database.url,
        'select revoked_at from identity.invitations where id = $1',
        [id],
      );
      expect(row!.revoked_at).toBeNull();
    });
  });
});
