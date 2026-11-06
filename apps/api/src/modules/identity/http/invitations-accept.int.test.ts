import { describe, expect, inject, it } from 'vitest';
import type { CreateInvitationResponse, InvitationDetails } from '@am/contracts';
import { createInvitationResponseSchema, invitationDetailsSchema } from '@am/contracts';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { hashToken } from '../domain/tokens.js';
import { createMigratedDatabase, dropDatabase, query } from '../../../../test/database.js';
import { startApi } from '../../../../test/api.js';

const password = 'correct-horse-battery';
const newPassword = 'novo-cavalo-bateria';
const webPublicUrl = 'https://app.example.com';

type Api = Awaited<ReturnType<typeof startApi>>;

/**
 * Delegates to the real hasher and records what it was asked for. Accepting an invitation costs a
 * derivation only when there is an invitation to accept (INV-06).
 */
function countingHasher() {
  const calls: string[] = [];
  return {
    calls,
    hash: (raw: string) => {
      calls.push('hash');
      return argon2idPasswordHasher.hash(raw);
    },
    verify: (phc: string, raw: string) => {
      calls.push('verify');
      return argon2idPasswordHasher.verify(phc, raw);
    },
    verifyDummy: (raw: string) => {
      calls.push('verifyDummy');
      return argon2idPasswordHasher.verifyDummy(raw);
    },
  };
}

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

/** Creates an invitation as the given admin and answers its token, taken from the link. */
async function invite(baseUrl: string, email: string, adminToken: string): Promise<CreateInvitationResponse & { token: string }> {
  const response = await fetch(`${baseUrl}/invitations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `am_session=${adminToken}` },
    body: JSON.stringify({ email }),
  });
  expect(response.status).toBe(201);
  const created = createInvitationResponseSchema.parse(await response.json());
  return { ...created, token: created.inviteUrl.split('/').at(-1)! };
}

function open(baseUrl: string, token: string) {
  return fetch(`${baseUrl}/invitations/${token}`);
}

function accept(baseUrl: string, token: string, body: unknown, cookie?: string) {
  return fetch(`${baseUrl}/invitations/${token}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie === undefined ? {} : { cookie }) },
    body: JSON.stringify(body),
  });
}

async function invitationRow(databaseUrl: string, token: string) {
  const [row] = await query<{ accepted_at: Date | null; revoked_at: Date | null }>(
    databaseUrl,
    'select accepted_at, revoked_at from identity.invitations where token_hash = $1',
    [hashToken(token)],
  );
  return row!;
}

async function membersOf(databaseUrl: string, email: string) {
  return query<{ id: string; email: string; name: string; role: string; password_hash: string }>(
    databaseUrl,
    'select id, email, name, role, password_hash from identity.users where email = $1',
    [email],
  );
}

async function withApi(
  run: (api: Api, database: Awaited<ReturnType<typeof createMigratedDatabase>>) => Promise<void>,
  options: { passwordHasher?: ReturnType<typeof countingHasher> } = {},
) {
  const database = await createMigratedDatabase(inject('databaseUrl'), 'invite_accept');
  const api = await startApi(database.url, { webPublicUrl, ...options });
  try {
    await run(api, database);
  } finally {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  }
}

/** An admin account and its session, the starting point of every test here. */
async function withAdmin(api: Api, database: Awaited<ReturnType<typeof createMigratedDatabase>>): Promise<string> {
  await createUser(database.url, 'admin.accept@example.com', 'admin');
  return signIn(api.baseUrl, 'admin.accept@example.com', 'admin');
}

describe('GET /invitations/:token', () => {
  it('answers 200 with email and expiresAt for a pending invitation', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'pendente.accept@example.com', adminToken);

      const response = await open(api.baseUrl, created.token);

      expect(response.status).toBe(200);
      const details: InvitationDetails = invitationDetailsSchema.parse(await response.json());
      // The screen shows the invited address read-only and the deadline; nothing else leaks (INV-05).
      expect(Object.keys(details).sort()).toEqual(['email', 'expiresAt']);
      expect(details.email).toBe('pendente.accept@example.com');
      expect(details.expiresAt).toBe(created.expiresAt);
    });
  });
});

describe('invalid invitations', () => {
  it('answer 410 for unknown expired accepted and revoked tokens on both endpoints', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);

      const expired = await invite(api.baseUrl, 'expirado.accept@example.com', adminToken);
      await query(database.url, "update identity.invitations set expires_at = now() - interval '1 second' where token_hash = $1", [
        hashToken(expired.token),
      ]);

      const accepted = await invite(api.baseUrl, 'usado.accept@example.com', adminToken);
      expect((await accept(api.baseUrl, accepted.token, { name: 'Usado', password: newPassword })).status).toBe(201);

      const revoked = await invite(api.baseUrl, 'revogado.accept@example.com', adminToken);
      // A second invitation for the same address revokes the link that came before it (INV-04).
      const replacement = await invite(api.baseUrl, 'revogado.accept@example.com', adminToken);

      const unusable = [
        { name: 'unknown', token: 'never-issued-token' },
        { name: 'expired', token: expired.token },
        { name: 'accepted', token: accepted.token },
        { name: 'revoked', token: revoked.token },
      ];
      for (const attempt of unusable) {
        const opened = await open(api.baseUrl, attempt.token);
        const submitted = await accept(api.baseUrl, attempt.token, { name: 'Alguém', password: newPassword });

        expect({ name: attempt.name, open: opened.status, accept: submitted.status }).toEqual({
          name: attempt.name,
          open: 410,
          accept: 410,
        });
        expect(opened.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
        expect(submitted.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
        // One answer for all four: the screen cannot describe why the link failed (INV-06).
        expect(await opened.text()).toBe(await submitted.text());
      }

      // Control: the replacement link is the one that works, so the 410s are about the token.
      expect((await open(api.baseUrl, replacement.token)).status).toBe(200);
      // None of the failed accepts created an account.
      expect(await membersOf(database.url, 'expirado.accept@example.com')).toEqual([]);
      expect(await membersOf(database.url, 'revogado.accept@example.com')).toEqual([]);
    });
  });

  it('reads the invitation before hashing the password, so an unknown token costs no derivation', async () => {
    const hasher = countingHasher();
    await withApi(async (api, database) => {
      // An unauthenticated caller could otherwise buy one Argon2 derivation per request by sending
      // any token: the invitation is what the answer depends on, so it is read first (INV-06).
      const response = await accept(api.baseUrl, 'never-issued-token', { name: 'Ana', password: newPassword });

      expect(response.status).toBe(410);
      expect(hasher.calls).toEqual([]);
      expect(await query(database.url, 'select id from identity.users')).toEqual([]);

      // Control: the same request with a real invitation does derive, so the empty list above is the
      // early answer and not a hasher that never gets called.
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'deriva.accept@example.com', adminToken);
      // The admin sign-in checked its own password; only the acceptance is under observation here.
      hasher.calls.length = 0;
      expect((await accept(api.baseUrl, created.token, { name: 'Ana', password: newPassword })).status).toBe(201);
      expect(hasher.calls).toEqual(['hash']);
    }, { passwordHasher: hasher });
  });
});

describe('POST /invitations/:token/accept', () => {
  it('creates the member marks accepted_at starts a session and answers 201', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'nova.accept@example.com', adminToken);

      const response = await accept(api.baseUrl, created.token, { name: 'Maria Silva', password: newPassword });

      expect(response.status).toBe(201);
      // The session starts right away: the browser is logged in by the same answer (INV-07).
      const cookie = response.headers.get('set-cookie')!;
      const token = /^am_session=([^;]+)/.exec(cookie)![1]!;
      const me = await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `am_session=${token}` } });
      expect(await me.json()).toEqual({
        id: expect.any(String),
        email: 'nova.accept@example.com',
        name: 'Maria Silva',
        role: 'member',
      });

      const [user] = await membersOf(database.url, 'nova.accept@example.com');
      expect(user!.role).toBe('member');
      expect(user!.name).toBe('Maria Silva');
      // The password is stored as the PHC hash, and it verifies only against the password chosen.
      expect(user!.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      await expect(argon2idPasswordHasher.verify(user!.password_hash, newPassword)).resolves.toBe(true);
      await expect(argon2idPasswordHasher.verify(user!.password_hash, password)).resolves.toBe(false);

      // The invitation is spent, and the session in the table is the one the cookie carries.
      expect((await invitationRow(database.url, created.token)).accepted_at).not.toBeNull();
      const sessions = await query<{ token_hash: string }>(
        database.url,
        'select token_hash from identity.sessions where user_id = $1',
        [user!.id],
      );
      expect(sessions.map((row) => row.token_hash)).toEqual([hashToken(token)]);
    });
  });

  it('answers 400 for out-of-range password and name and keeps the invitation pending', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'limites.accept@example.com', adminToken);

      const rejected = [
        { name: 'password of 11', body: { name: 'Ana', password: 'a'.repeat(11) } },
        { name: 'password of 129', body: { name: 'Ana', password: 'a'.repeat(129) } },
        { name: 'blank name', body: { name: '   ', password: newPassword } },
        { name: 'name of 121', body: { name: 'a'.repeat(121), password: newPassword } },
      ];
      for (const attempt of rejected) {
        const response = await accept(api.baseUrl, created.token, attempt.body);

        expect({ name: attempt.name, status: response.status }).toEqual({ name: attempt.name, status: 400 });
        expect(response.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      }

      // The invitation is still pending and no account was made, so the person can try again (INV-08).
      expect((await invitationRow(database.url, created.token)).accepted_at).toBeNull();
      expect(await membersOf(database.url, 'limites.accept@example.com')).toEqual([]);
      // Control: the same link with a password inside the rule goes through.
      expect((await accept(api.baseUrl, created.token, { name: 'Ana', password: newPassword })).status).toBe(201);
    });
  });

  it('two concurrent accepts create one user and the other gets 410', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'corrida.accept@example.com', adminToken);

      const answers = await Promise.all([
        accept(api.baseUrl, created.token, { name: 'Ana Primeira', password: newPassword }),
        accept(api.baseUrl, created.token, { name: 'Ana Segunda', password: newPassword }),
      ]);

      const statuses = answers.map((answer) => answer.status).sort();
      expect(statuses).toEqual([201, 410]);
      // Exactly one account, with the name of the accept that won (INV-09).
      const members = await membersOf(database.url, 'corrida.accept@example.com');
      expect(members).toHaveLength(1);

      // The winner is the one that answered 201, and the stored name is its own: the loser wrote nothing.
      const winner = answers.findIndex((answer) => answer.status === 201);
      const winnerName = winner === 0 ? 'Ana Primeira' : 'Ana Segunda';
      expect(members[0]!.name).toBe(winnerName);

      // Exactly one session for the account, and it is the one the winning answer handed over.
      const sessions = await query<{ token_hash: string }>(
        database.url,
        'select token_hash from identity.sessions where user_id = $1',
        [members[0]!.id],
      );
      expect(sessions).toHaveLength(1);
      const winningToken = /^am_session=([^;]+)/.exec(answers[winner]!.headers.get('set-cookie') ?? '')![1]!;
      expect(sessions[0]!.token_hash).toBe(hashToken(winningToken));
      // The loser handed over no cookie at all.
      expect(answers[1 - winner]!.headers.get('set-cookie')).toBeNull();

      expect((await invitationRow(database.url, created.token)).accepted_at).not.toBeNull();
    });
  });

  it('answers 410 and keeps the user created after the invitation', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'tarde.accept@example.com', adminToken);
      // Somebody created the account while the invitation was pending: the link cannot overwrite it (EDGE-05).
      const existingId = await createUser(database.url, 'tarde.accept@example.com', 'member');
      const before = await membersOf(database.url, 'tarde.accept@example.com');

      const response = await accept(api.baseUrl, created.token, { name: 'Tarde', password: newPassword });

      expect(response.status).toBe(410);
      // The account is exactly what it was: same id, same hash, same name.
      expect(await membersOf(database.url, 'tarde.accept@example.com')).toEqual(before);
      expect(before[0]!.id).toBe(existingId);
      // The invitation was not spent by the failed attempt, and no session was made for the account.
      expect((await invitationRow(database.url, created.token)).accepted_at).toBeNull();
      expect(await query(database.url, 'select id from identity.sessions where user_id = $1', [existingId])).toEqual([]);
    });
  });

  it('revokes the current session before starting the new one', async () => {
    await withApi(async (api, database) => {
      const adminToken = await withAdmin(api, database);
      const created = await invite(api.baseUrl, 'trocada.accept@example.com', adminToken);
      // The browser already has a session of another account when it accepts the invitation (INV-10).
      const previousToken = await signIn(api.baseUrl, 'admin.accept@example.com', 'admin');

      const response = await accept(api.baseUrl, created.token, { name: 'Ana Trocada', password: newPassword }, `am_session=${previousToken}`);

      expect(response.status).toBe(201);
      // The old cookie no longer works: a browser keeps one session (INV-10).
      const old = await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `am_session=${previousToken}` } });
      expect(old.status).toBe(401);

      const newToken = /^am_session=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')![1]!;
      const me = await fetch(`${api.baseUrl}/auth/me`, { headers: { cookie: `am_session=${newToken}` } });
      expect((await me.json() as { email: string }).email).toBe('trocada.accept@example.com');
    });
  });
});
