import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPool } from '../../../infra/database/pool.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { SkillsRepository } from '../infra/skills.repository.js';
import { SkillsCatalog } from '../index.js';

describe('SkillsCatalog.describe and matchingIds', () => {
  let database: TestDatabase;
  let catalog: SkillsCatalog;
  let close: () => Promise<void>;
  const ana = randomUUID();
  const bruno = randomUUID();
  let nodeId: string;
  let globalWithAliasId: string;
  let anaPrivateId: string;
  let brunoPrivateId: string;

  const insertSkill = async (owner: string | null, name: string, key: string, category = 'tool'): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      'insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $2, $3::skills.skill_category, $4) returning id',
      [name, key, category, owner],
    );
    return row!.id;
  };

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_catalog_describe');
    const pool = createPool(database.url);
    catalog = new SkillsCatalog(new SkillsRepository(drizzle(pool)));
    close = () => pool.end();
    const [node] = await query<{ id: string }>(database.url, "select id from skills.skills where normalized_key = 'nodejs'");
    nodeId = node!.id;
    globalWithAliasId = await insertSkill(null, 'Skill Fictícia Gama', 'skillficticiagama', 'framework');
    await query(
      database.url,
      "insert into skills.skill_aliases (skill_id, alias, normalized_alias) values ($1, 'Apelido Fictício Zeta', 'apelidoficticiozeta')",
      [globalWithAliasId],
    );
    anaPrivateId = await insertSkill(ana, 'Skill Fictícia Alfa', 'skillficticiaalfa', 'practice');
    brunoPrivateId = await insertSkill(bruno, 'Skill Fictícia Alfa Beta', 'skillficticiaalfabeta');
  }, 120_000);

  afterAll(async () => {
    await close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('APP-08 describes a global skill and the own private skill with official name, category and scope', async () => {
    const described = await catalog.describe(ana, [nodeId, anaPrivateId]);

    expect(described.get(nodeId)).toEqual({ id: nodeId, name: 'Node.js', category: 'language', scope: 'global' });
    expect(described.get(anaPrivateId)).toEqual({ id: anaPrivateId, name: 'Skill Fictícia Alfa', category: 'practice', scope: 'private' });
    expect(described.size).toBe(2);
  });

  it('APP-08 leaves out the private skill of another person, an id that does not exist and text that is not a uuid', async () => {
    const described = await catalog.describe(ana, [nodeId, brunoPrivateId, randomUUID(), 'not-a-uuid', '']);

    expect([...described.keys()]).toEqual([nodeId]);
    expect([...(await catalog.describe(bruno, [anaPrivateId])).keys()]).toEqual([]);
  });

  it('APP-08 answers an empty map for no ids and for ids none of which is visible', async () => {
    expect((await catalog.describe(ana, [])).size).toBe(0);
    expect((await catalog.describe(ana, ['not-a-uuid', brunoPrivateId])).size).toBe(0);
  });

  it('APP-88 describes a promoted private skill with the same id as global', async () => {
    const [promoted] = await query<{ id: string }>(
      database.url,
      'update skills.skills set owner_user_id = null where id = $1 returning id',
      [anaPrivateId],
    );

    const described = await catalog.describe(ana, [promoted!.id]);
    const byBruno = await catalog.describe(bruno, [promoted!.id]);

    expect(described.get(anaPrivateId)).toEqual({ id: anaPrivateId, name: 'Skill Fictícia Alfa', category: 'practice', scope: 'global' });
    expect(byBruno.get(anaPrivateId)?.scope).toBe('global');
    await query(database.url, 'update skills.skills set owner_user_id = $2 where id = $1', [anaPrivateId, ana]);
  });

  it('APP-13 finds a global skill by its name key', async () => {
    expect(await catalog.matchingIds(ana, 'nodejs')).toContain(nodeId);
  });

  it('APP-13 finds a skill whose name does not contain the key but an alias does', async () => {
    expect(await catalog.matchingIds(ana, 'apelidoficticiozeta')).toEqual([globalWithAliasId]);
    expect(await catalog.matchingIds(ana, 'ficticiozeta')).toEqual([globalWithAliasId]);
  });

  it('APP-13 finds Node.js with part of its key, "node"', async () => {
    const ids = await catalog.matchingIds(ana, 'node');

    expect(ids).toContain(nodeId);
  });

  it('APP-13 normalizes the key it receives, so "Node.JS" and "NODEJS" find the same skills as "nodejs"', async () => {
    const expected = (await catalog.matchingIds(ana, 'nodejs')).sort();

    expect((await catalog.matchingIds(ana, 'Node.JS')).sort()).toEqual(expected);
    expect((await catalog.matchingIds(ana, 'NODEJS')).sort()).toEqual(expected);
  });

  it('APP-13 returns only the visible skills: the own privates and the globals, never those of another person', async () => {
    expect((await catalog.matchingIds(ana, 'skillficticiaalfa')).sort()).toEqual([anaPrivateId].sort());
    expect((await catalog.matchingIds(bruno, 'skillficticiaalfa')).sort()).toEqual([brunoPrivateId].sort());
    expect(await catalog.matchingIds(ana, 'skillficticiabeta')).toEqual([]);
  });

  it('APP-13 matches nothing for a key with no letter or digit and treats % and _ as plain text', async () => {
    expect(await catalog.matchingIds(ana, '')).toEqual([]);
    expect(await catalog.matchingIds(ana, '...')).toEqual([]);
    expect(await catalog.matchingIds(ana, '%')).toEqual([]);
    expect(await catalog.matchingIds(ana, 'zzzsemresultado')).toEqual([]);
  });
});
