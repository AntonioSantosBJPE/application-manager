import { normalizeSkillKey } from '@am/contracts';
import { Module, type DynamicModule, type INestApplication, type Type } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { startApi } from '../../../../test/api.js';
import { asAccount, createAccount, type TestAccount } from '../../../../test/accounts.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { AppModule } from '../../../app.module.js';
import { createApp } from '../../../create-app.js';

type Api = Awaited<ReturnType<typeof startApi>>;

/** `METHOD /path` of every route the application registered, found the way the access test finds them. */
function registeredRoutes(app: INestApplication): string[] {
  const discovery = app.get(DiscoveryService, { strict: false });
  const scanner = new MetadataScanner();
  const names = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];
  const routes: string[] = [];
  for (const { instance, metatype } of discovery.getControllers()) {
    if (instance === null || metatype === undefined) continue;
    const prefix = Reflect.getMetadata('path', metatype as Type) ?? '';
    for (const method of scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
      const handler = instance[method as keyof typeof instance] as unknown as object;
      const path = Reflect.getMetadata('path', handler) as string | undefined;
      const httpMethod = Reflect.getMetadata('method', handler) as number | undefined;
      if (path === undefined || httpMethod === undefined) continue;
      const joined = [prefix, path]
        .map((part: string) => part.replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
        .join('/');
      routes.push(`${names[httpMethod]} /${joined}`);
    }
  }
  return routes;
}

describe('the skills catalog invariants', () => {
  let database: TestDatabase;
  let api: Api;
  let admin: TestAccount;
  let ana: TestAccount;
  let bruno: TestAccount;

  const call = (method: string, path: string, account: TestAccount, body?: unknown): Promise<Response> =>
    fetch(`${api.baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...asAccount(account) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const insertSkill = async (owner: TestAccount | null, name: string): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      "insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $2, 'tool', $3) returning id",
      [name, normalizeSkillKey(name), owner?.id ?? null],
    );
    return row!.id;
  };
  const insertAlias = async (skillId: string, alias: string): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      'insert into skills.skill_aliases (skill_id, alias, normalized_alias) values ($1, $2, $3) returning id',
      [skillId, alias, normalizeSkillKey(alias)],
    );
    return row!.id;
  };
  /** Every key that two global skills share, or that a global skill shares with an alias. */
  const violations = () =>
    query<{ normalized_key: string }>(
      database.url,
      `select normalized_key from skills.skills where owner_user_id is null group by 1 having count(*) > 1
       union all
       select a.normalized_alias from skills.skill_aliases a
         join skills.skills s on s.normalized_key = a.normalized_alias and s.owner_user_id is null
       union all
       select normalized_alias from skills.skill_aliases group by 1 having count(*) > 1`,
    );
  const holdersOf = async (key: string): Promise<number> => {
    const [row] = await query<{ holders: string }>(
      database.url,
      `select (select count(*) from skills.skills where owner_user_id is null and normalized_key = $1)
            + (select count(*) from skills.skill_aliases where normalized_alias = $1) as holders`,
      [key],
    );
    return Number(row!.holders);
  };

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_invariants');
    api = await startApi(database.url);
    admin = await createAccount(database.url, api.baseUrl, 'admin.invariants@example.com', 'admin');
    ana = await createAccount(database.url, api.baseUrl, 'ana.invariants@example.com', 'member');
    bruno = await createAccount(database.url, api.baseUrl, 'bruno.invariants@example.com', 'member');
  }, 120_000);

  afterAll(async () => {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-25 registers no route that makes a global skill private or deletes a skill', async () => {
    @Module({ imports: [AppModule.forRoot({ databaseUrl: database.url, webPublicUrl: 'http://localhost:3000', sessionCookieSecure: false, port: 0, logLevel: 'info' }), DiscoveryModule] })
    class ObservedModule {}
    const module: DynamicModule = { module: ObservedModule };
    const app = await createApp(module);
    try {
      const skillRoutes = registeredRoutes(app)
        .filter((route) => /^\w+ \/(admin\/)?skills/.test(route))
        .sort();

      // The whole surface of the catalog: nothing deletes a skill and nothing writes the scope.
      expect(skillRoutes).toEqual(
        [
          'DELETE /skills/:id/aliases/:aliasId',
          'GET /admin/skills',
          'GET /skills',
          'PATCH /skills/:id',
          'PATCH /skills/:id/aliases/:aliasId',
          'POST /skills',
          'POST /skills/:id/aliases',
          'POST /skills/:id/promote',
        ].sort(),
      );
    } finally {
      await app.close();
    }

    // Calls that look like the missing operations find no route, and the skill stays global.
    const id = await insertSkill(null, 'Skill Fictícia Alfa');
    for (const account of [admin, ana]) {
      for (const [method, path] of [
        ['DELETE', `/skills/${id}`],
        ['DELETE', `/admin/skills/${id}`],
        ['POST', `/skills/${id}/demote`],
        ['POST', `/skills/${id}/unpromote`],
      ] as const) {
        expect((await call(method, path, account)).status, `${method} ${path}`).toBe(404);
      }
    }
    // The scope and the owner are not fields of the edit: they are dropped and the skill stays global.
    const edited = await call('PATCH', `/skills/${id}`, admin, { category: 'practice', scope: 'private', ownerUserId: ana.id });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toEqual({ id, name: 'Skill Fictícia Alfa', category: 'practice', scope: 'global' });
    expect(await query(database.url, 'select owner_user_id from skills.skills where id = $1', [id])).toEqual([{ owner_user_id: null }]);
  });

  it('SKL-32 never leaves a global key equal to another global key or an alias when promote, rename, add alias and edit alias race for one key', async () => {
    const key = normalizeSkillKey('Skill Fictícia Alfa');
    const rounds = 10;

    for (let round = 0; round < rounds; round += 1) {
      await query(database.url, 'delete from skills.skills');
      const privateAna = await insertSkill(ana, 'Skill Fictícia Alfa');
      const privateBruno = await insertSkill(bruno, 'skill ficticia alfa');
      const renamed = await insertSkill(null, 'Skill Fictícia Beta');
      const aliased = await insertSkill(null, 'Drizzle ORM de Teste');
      // The edited alias lives on another global skill, so its PATCH and the alias POST race on different skills.
      const other = await insertSkill(null, 'Drizzle ORM de Teste Dois');
      const edited = await insertAlias(other, 'Drizzle Teste Dois');

      // Five writes want the same key; the order they start in changes every round.
      const writes: Array<() => Promise<Response>> = [
        () => call('POST', `/skills/${privateAna}/promote`, admin),
        () => call('POST', `/skills/${privateBruno}/promote`, admin),
        () => call('PATCH', `/skills/${renamed}`, admin, { name: 'Skill Fictícia Alfa' }),
        () => call('POST', `/skills/${aliased}/aliases`, admin, { alias: 'skill ficticia alfa' }),
        () => call('PATCH', `/skills/${other}/aliases/${edited}`, admin, { alias: 'Skill-Ficticia-Alfa' }),
      ];
      const order = writes.map((_, index) => writes[(index + round) % writes.length]!);

      const statuses = (await Promise.all(order.map((write) => write()))).map((response) => response.status);

      expect(statuses.filter((status) => status >= 200 && status < 300), `round ${round}: ${statuses}`).toHaveLength(1);
      expect(statuses.filter((status) => status === 409), `round ${round}: ${statuses}`).toHaveLength(4);
      expect(await violations(), `round ${round}`).toEqual([]);
      expect(await holdersOf(key), `round ${round}`).toBe(1);
    }
  }, 60_000);
});
