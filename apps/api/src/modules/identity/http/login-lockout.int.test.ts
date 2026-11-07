import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { argon2idPasswordHasher, type PasswordHasher } from '../application/password-hasher.js';
import { LOCKOUT_WINDOW_MS } from '../domain/lockout.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { startApi } from '../../../../test/api.js';
import { testClock, type TestClock } from '../../../../test/clock.js';

const password = 'correct-horse-battery';
const pairIp = '203.0.113.7';
const otherIp = '203.0.113.8';

async function createUser(databaseUrl: string, email: string, role: 'admin' | 'member'): Promise<string> {
  const passwordHash = await argon2idPasswordHasher.hash(password);
  const [row] = await query<{ id: string }>(
    databaseUrl,
    'insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id',
    [email, 'Ana', passwordHash, role],
  );
  return row!.id;
}

/** Records every verification it is asked for; the cheap variant only counts, for bursts. */
function countingHasher(verify: PasswordHasher['verify'] = (phc, raw) => argon2idPasswordHasher.verify(phc, raw)) {
  const calls: string[] = [];
  const hasher: PasswordHasher & { calls: string[] } = {
    calls,
    hash: (raw) => argon2idPasswordHasher.hash(raw),
    verify: (phc, raw) => {
      calls.push('verify');
      return verify(phc, raw);
    },
    verifyDummy: (raw) => {
      calls.push('verifyDummy');
      return verify('', raw);
    },
  };
  return hasher;
}

/** Answers no password: the counting tests are about the lockout, never about the hash. */
const refuseEveryPassword = countingHasher(async () => false);

function attempt(baseUrl: string, body: unknown, options: { path?: string; ip?: string } = {}) {
  return fetch(`${baseUrl}${options.path ?? '/auth/login'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(options.ip === undefined ? {} : { 'x-am-client-ip': options.ip }) },
    body: JSON.stringify(body),
  });
}

async function failureRows(databaseUrl: string, ip: string): Promise<{ email: string; pair_cleared: boolean }[]> {
  return query<{ email: string; pair_cleared: boolean }>(
    databaseUrl,
    'select email, pair_cleared from identity.login_attempts where ip = $1 order by attempted_at',
    [ip],
  );
}

describe('login lockout', () => {
  let database: TestDatabase;
  let clock: TestClock;
  let memberEmail: string;
  let adminEmail: string;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'lockout');
    memberEmail = 'member-lock@example.com';
    adminEmail = 'admin-lock@example.com';
    await createUser(database.url, memberEmail, 'member');
    await createUser(database.url, adminEmail, 'admin');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  beforeEach(async () => {
    clock = testClock('2026-11-03T12:00:00.000Z');
    await query(database.url, 'delete from identity.login_attempts');
  });

  /** Five failures of the pair, the amount that blocks it (LOCK-01). */
  async function fillPair(baseUrl: string, ip: string, email: string): Promise<void> {
    for (let i = 0; i < 5; i += 1) {
      expect((await attempt(baseUrl, { email, password: 'wrong-but-long-enough' }, { ip })).status).toBe(401);
    }
  }

  it('answers 429 after 5 pair failures even with the correct password', async () => {
    const api = await startApi(database.url, { clock, passwordHasher: refuseEveryPassword });
    try {
      await fillPair(api.baseUrl, pairIp, memberEmail);

      const blocked = await attempt(api.baseUrl, { email: memberEmail, password }, { ip: pairIp });

      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('content-type')).toBe('application/problem+json; charset=utf-8');
      expect(await blocked.text()).toBe(
        JSON.stringify({ type: 'about:blank', title: 'Too Many Requests', status: 429, detail: 'Too many login attempts' }),
      );
      // The correct password bought nothing, and no session was made.
      expect(blocked.headers.get('set-cookie')).toBeNull();
      // Another address is unaffected: the block is of the pair, not of the whole API.
      expect((await attempt(api.baseUrl, { email: memberEmail, password }, { ip: otherIp })).status).toBe(401);
    } finally {
      await api.close();
    }
  });

  it('answers 429 for any email after 50 failures from one ip', async () => {
    const api = await startApi(database.url, { clock, passwordHasher: refuseEveryPassword });
    try {
      for (let i = 0; i < 50; i += 1) {
        // Fifty different emails: no pair reaches its own limit, so only the address can block (LOCK-02).
        const response = await attempt(api.baseUrl, { email: `nobody-${i}@example.com`, password }, { ip: otherIp });
        expect(response.status).toBe(401);
      }

      const blocked = await attempt(api.baseUrl, { email: memberEmail, password }, { ip: otherIp });

      expect(blocked.status).toBe(429);
      // The same address is blocked for an email that never failed, and the other address still works.
      expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong' }, { ip: pairIp })).status).toBe(401);
    } finally {
      await api.close();
    }
  });

  it('sends Retry-After until the oldest counted failure leaves the window', async () => {
    const api = await startApi(database.url, { clock, passwordHasher: refuseEveryPassword });
    try {
      await fillPair(api.baseUrl, pairIp, memberEmail);
      // A minute later the oldest failure is still 14 minutes from leaving the window.
      clock.advance(60_000);

      const blocked = await attempt(api.baseUrl, { email: memberEmail, password: 'wrong' }, { ip: pairIp });
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get('retry-after')).toBe('840');

      // The wait is exact: one second before it, still refused; one second after, the window is open.
      clock.advance((840 - 1) * 1000);
      expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong' }, { ip: pairIp })).status).toBe(429);
      clock.advance(1000);
      expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong' }, { ip: pairIp })).status).toBe(401);
    } finally {
      await api.close();
    }
  });

  it('treats known and unknown emails alike with the same 429 body', async () => {
    const api = await startApi(database.url, { clock, passwordHasher: refuseEveryPassword });
    try {
      // A known pair blocks at 5, and so does an unknown one.
      await fillPair(api.baseUrl, pairIp, memberEmail);
      await fillPair(api.baseUrl, otherIp, 'unknown-block@example.com');

      const known = await attempt(api.baseUrl, { email: memberEmail, password: 'wrong' }, { ip: pairIp });
      const unknown = await attempt(api.baseUrl, { email: 'unknown-block@example.com', password }, { ip: otherIp });

      expect([known.status, unknown.status]).toEqual([429, 429]);
      expect(known.headers.get('retry-after')).toBe(unknown.headers.get('retry-after'));
      expect(await known.text()).toBe(await unknown.text());
    } finally {
      await api.close();
    }
  });

  it('a blocked attempt runs no argon2 and records no failure', async () => {
    const hasher = countingHasher();
    const api = await startApi(database.url, { clock, passwordHasher: hasher });
    try {
      await fillPair(api.baseUrl, pairIp, memberEmail);
      const before = await failureRows(database.url, pairIp);
      expect(before).toHaveLength(5);

      hasher.calls.length = 0;
      const blocked = await attempt(api.baseUrl, { email: memberEmail, password }, { ip: pairIp });

      expect(blocked.status).toBe(429);
      // No password work at all, and the table did not grow (LOCK-05).
      expect(hasher.calls).toEqual([]);
      expect(await failureRows(database.url, pairIp)).toHaveLength(5);

      // Control: the same attempt from another address does reach the hasher.
      expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong-but-long-enough' }, { ip: otherIp })).status).toBe(401);
      expect(hasher.calls).toEqual(['verify']);
    } finally {
      await api.close();
    }
  });

  it('a success clears the pair and keeps the ip count', async () => {
    const api = await startApi(database.url, { clock, passwordHasher: countingHasher() });
    try {
      for (let i = 0; i < 4; i += 1) {
        expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong-but-long-enough' }, { ip: pairIp })).status).toBe(401);
      }

      expect((await attempt(api.baseUrl, { email: memberEmail, password }, { ip: pairIp })).status).toBe(204);

      // The pair starts over: five more failures are counted before the next refusal.
      for (let i = 0; i < 5; i += 1) {
        expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong-but-long-enough' }, { ip: pairIp })).status).toBe(401);
      }
      expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong-but-long-enough' }, { ip: pairIp })).status).toBe(429);

      // The address keeps every failure it saw, including the four the success cleared for the pair (LOCK-06).
      const rows = await failureRows(database.url, pairIp);
      expect(rows).toHaveLength(9);
      expect(rows.filter((row) => row.pair_cleared)).toHaveLength(4);
      expect(rows.filter((row) => !row.pair_cleared && row.email === memberEmail)).toHaveLength(5);

      // Those nine are failures of the address, so 41 more of other emails reach its 50 failures and
      // every one of them is still judged on its own pair: 401 (LOCK-02, LOCK-06).
      for (let i = 0; i < 41; i += 1) {
        expect((await attempt(api.baseUrl, { email: `other-${i}@example.com`, password }, { ip: pairIp })).status).toBe(401);
      }
      expect(await failureRows(database.url, pairIp)).toHaveLength(50);

      // The address is now blocked for an email that never failed from it: the four rows the success
      // cleared are part of the 50, and leaving them out would answer this attempt with a 401.
      const thirdEmail = await attempt(api.baseUrl, { email: 'third@example.com', password }, { ip: pairIp });
      expect(thirdEmail.status).toBe(429);
    } finally {
      await api.close();
    }
  });

  it('accepts attempts after the window and deletes expired rows on the next failure', async () => {
    const api = await startApi(database.url, { clock, passwordHasher: countingHasher() });
    try {
      await fillPair(api.baseUrl, pairIp, memberEmail);
      expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong' }, { ip: pairIp })).status).toBe(429);

      clock.advance(LOCKOUT_WINDOW_MS + 1_000);

      // Inside the window's limit again: the same attempt is judged on its password.
      expect((await attempt(api.baseUrl, { email: memberEmail, password }, { ip: pairIp })).status).toBe(204);
      // A clock a day later: the five rows of the old window are gone, leaving only the new failure.
      clock.advance(24 * 60 * 60 * 1000);
      expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong-but-long-enough' }, { ip: pairIp })).status).toBe(401);
      expect(await failureRows(database.url, pairIp)).toHaveLength(1);
    } finally {
      await api.close();
    }
  });

  it('both entrances share the failure counters', async () => {
    const api = await startApi(database.url, { clock, passwordHasher: countingHasher() });
    try {
      // Failures counted on the member entrance for the admin account, then the admin entrance refuses
      // the right admin password: the counter is keyed by email + IP, not by the entrance (LOCK-08).
      await fillPair(api.baseUrl, pairIp, adminEmail);
      const admin = await attempt(api.baseUrl, { email: adminEmail, password }, { path: '/auth/admin/login', ip: pairIp });
      expect(admin.status).toBe(429);

      // The reverse direction: failures counted on the admin entrance block the member one.
      for (let i = 0; i < 5; i += 1) {
        expect((await attempt(api.baseUrl, { email: memberEmail, password: 'wrong-but-long-enough' }, { path: '/auth/admin/login', ip: otherIp })).status).toBe(401);
      }
      const member = await attempt(api.baseUrl, { email: memberEmail, password }, { ip: otherIp });
      expect(member.status).toBe(429);
    } finally {
      await api.close();
    }
  });

  it('lets only five of a simultaneous burst reach argon2', async () => {
    const hasher = countingHasher();
    const api = await startApi(database.url, { clock, passwordHasher: hasher });
    try {
      // Twenty requests at the same instant: the counter is decided under one advisory lock of the address.
      const answers = await Promise.all(
        Array.from({ length: 20 }, () =>
          attempt(api.baseUrl, { email: memberEmail, password: 'wrong-but-long-enough' }, { ip: pairIp }),
        ),
      );

      const statuses = answers.map((answer) => answer.status).sort();
      expect(statuses.filter((status) => status === 401)).toHaveLength(5);
      expect(statuses.filter((status) => status === 429)).toHaveLength(15);
      expect(hasher.calls.filter((call) => call === 'verify')).toHaveLength(5);
      expect(await failureRows(database.url, pairIp)).toHaveLength(5);
    } finally {
      await api.close();
    }
  });
});
