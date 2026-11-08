import { skillSchema } from '@am/contracts';
import { describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query } from '../../../../test/database.js';

type Api = Awaited<ReturnType<typeof startApi>>;

interface Env {
  api: Api;
  databaseUrl: string;
  ana: TestAccount;
  bruno: TestAccount;
  admin: TestAccount;
}

async function withEnv(run: (env: Env) => Promise<void>): Promise<void> {
  const database = await createMigratedDatabase(inject('databaseUrl'), 'skills_create');
  const api = await startApi(database.url);
  try {
    await run({
      api,
      databaseUrl: database.url,
      ana: await createAccount(database.url, api.baseUrl, 'ana.create@example.com', 'member'),
      bruno: await createAccount(database.url, api.baseUrl, 'bruno.create@example.com', 'member'),
      admin: await createAccount(database.url, api.baseUrl, 'admin.create@example.com', 'admin'),
    });
  } finally {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  }
}

const post = (env: Env, account: TestAccount, body: unknown): Promise<Response> =>
  fetch(`${env.api.baseUrl}/skills`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...asAccount(account) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const countSkills = async (env: Env): Promise<number> =>
  Number((await query<{ count: string }>(env.databaseUrl, 'select count(*) from skills.skills'))[0]!.count);

const rowsOfKey = (env: Env, key: string) =>
  query<{ id: string; name: string; category: string; owner_user_id: string | null }>(
    env.databaseUrl,
    'select id, name, category, owner_user_id from skills.skills where normalized_key = $1 order by owner_user_id nulls first',
    [key],
  );

describe('POST /skills', () => {
  it('SKL-11 creates the private skill of the session user and answers 201 with { id, name, category, scope }', async () => {
    await withEnv(async (env) => {
      const before = await countSkills(env);

      // Spaces at the ends and doubled inside are cleaned before the name is saved.
      const response = await post(env, env.ana, { name: '  Skill Fictícia   Alfa ', category: 'tool' });

      expect(response.status).toBe(201);
      const body = skillSchema.parse(await response.json());
      expect(body).toEqual({ id: expect.any(String), name: 'Skill Fictícia Alfa', category: 'tool', scope: 'private' });
      expect(Object.keys(body).sort()).toEqual(['category', 'id', 'name', 'scope']);
      expect(await rowsOfKey(env, 'skillficticiaalfa')).toEqual([
        { id: body.id, name: 'Skill Fictícia Alfa', category: 'tool', owner_user_id: env.ana.id },
      ]);
      expect(await countSkills(env)).toBe(before + 1);
    });
  });

  it('SKL-12 answers 200 with the own private skill, ignoring the category sent, and writes no row', async () => {
    await withEnv(async (env) => {
      const created = skillSchema.parse(await (await post(env, env.ana, { name: 'Skill Fictícia Alfa', category: 'tool' })).json());
      const before = await countSkills(env);

      const response = await post(env, env.ana, { name: 'skill fictícia ALFA', category: 'language' });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: created.id, name: 'Skill Fictícia Alfa', category: 'tool', scope: 'private' });
      expect(await countSkills(env)).toBe(before);
    });
  });

  it('SKL-12 answers 200 with the global skill when the name is its name or an alias, and writes no row', async () => {
    await withEnv(async (env) => {
      const [node] = await rowsOfKey(env, 'nodejs');
      const [golang] = await rowsOfKey(env, 'go');
      const before = await countSkills(env);

      for (const name of ['node.js', 'NodeJS', 'Node']) {
        const response = await post(env, env.ana, { name, category: 'practice' });
        expect(response.status, name).toBe(200);
        expect(await response.json(), name).toEqual({ id: node!.id, name: 'Node.js', category: 'language', scope: 'global' });
      }
      const byAlias = await post(env, env.ana, { name: 'Golang', category: 'practice' });
      expect(byAlias.status).toBe(200);
      expect(await byAlias.json()).toEqual({ id: golang!.id, name: 'Go', category: 'language', scope: 'global' });
      expect(await countSkills(env)).toBe(before);
    });
  });

  it('SKL-13 saves one skill and answers 201 to one of two simultaneous requests and 200 to the other', async () => {
    await withEnv(async (env) => {
      const before = await countSkills(env);

      const responses = await Promise.all([
        post(env, env.ana, { name: 'Drizzle ORM de Teste', category: 'framework' }),
        post(env, env.ana, { name: 'drizzle orm de teste', category: 'framework' }),
      ]);

      expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
      const [first, second] = await Promise.all(responses.map(async (r) => skillSchema.parse(await r.json())));
      expect(first!.id).toBe(second!.id);
      expect(await rowsOfKey(env, 'drizzleormdeteste')).toHaveLength(1);
      expect(await countSkills(env)).toBe(before + 1);
    });
  });

  it('SKL-13 keeps one row and one 201 when eight requests race for the same new key', async () => {
    await withEnv(async (env) => {
      const spellings = ['Skill Fictícia Beta', 'skill fictícia beta', 'SKILL FICTICIA BETA', 'Skill  Ficticia  Beta'];

      const responses = await Promise.all(
        Array.from({ length: 8 }, (_, i) => post(env, env.ana, { name: spellings[i % spellings.length], category: 'tool' })),
      );

      const statuses = responses.map((r) => r.status);
      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 200)).toHaveLength(7);
      expect(await rowsOfKey(env, 'skillficticiabeta')).toHaveLength(1);
    });
  });

  it('SKL-14 creates a separate private skill, with another id, for a person when only a third person has the name', async () => {
    await withEnv(async (env) => {
      const first = skillSchema.parse(await (await post(env, env.ana, { name: 'Drizzle ORM de Teste', category: 'framework' })).json());

      const response = await post(env, env.bruno, { name: 'Drizzle ORM de Teste', category: 'framework' });

      expect(response.status).toBe(201);
      const second = skillSchema.parse(await response.json());
      expect(second.id).not.toBe(first.id);
      expect(second.scope).toBe('private');
      const rows = await rowsOfKey(env, 'drizzleormdeteste');
      expect(rows.map((r) => r.owner_user_id).sort()).toEqual([env.ana.id, env.bruno.id].sort());
    });
  });

  it('SKL-15 answers 400 in Problem Details naming the invalid field and writes nothing', async () => {
    await withEnv(async (env) => {
      const before = await countSkills(env);
      const invalid: [unknown, string][] = [
        [{ category: 'tool' }, 'name'],
        [{ name: '', category: 'tool' }, 'name'],
        [{ name: '   ', category: 'tool' }, 'name'],
        [{ name: 'a'.repeat(61), category: 'tool' }, 'name'],
        [{ name: '...', category: 'tool' }, 'name'],
        [{ name: 42, category: 'tool' }, 'name'],
        [{ name: 'Skill\u0000Fictícia', category: 'tool' }, 'name'],
        [{ name: 'Skill\u0007Fictícia', category: 'tool' }, 'name'],
        [{ name: 'Skill Fictícia Alfa' }, 'category'],
        [{ name: 'Skill Fictícia Alfa', category: 'hobby' }, 'category'],
      ];

      for (const [body, field] of invalid) {
        const response = await post(env, env.ana, body);
        expect(response.status, JSON.stringify(body)).toBe(400);
        expect(response.headers.get('content-type')).toContain('application/problem+json');
        const problem = (await response.json()) as { status: number; errors: { path: string }[] };
        expect(problem.status).toBe(400);
        expect(problem.errors.map((e) => e.path)).toContain(field);
      }
      expect((await post(env, env.ana, undefined)).status).toBe(400);
      expect(await countSkills(env)).toBe(before);
    });
  });

  it('SKL-16 takes the owner from the session and ignores ownerUserId and scope in the body', async () => {
    await withEnv(async (env) => {
      const response = await post(env, env.ana, {
        name: 'Skill Fictícia Alfa',
        category: 'tool',
        ownerUserId: env.bruno.id,
        scope: 'global',
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ scope: 'private' });
      expect((await rowsOfKey(env, 'skillficticiaalfa')).map((r) => r.owner_user_id)).toEqual([env.ana.id]);
    });
  });

  it('SKL-23 answers 403 to an admin on GET and POST /skills and writes nothing', async () => {
    await withEnv(async (env) => {
      const before = await countSkills(env);

      const list = await fetch(`${env.api.baseUrl}/skills`, { headers: asAccount(env.admin) });
      const create = await post(env, env.admin, { name: 'Skill Fictícia Alfa', category: 'tool' });

      expect(list.status).toBe(403);
      expect(create.status).toBe(403);
      expect(await countSkills(env)).toBe(before);
    });
  });
});
