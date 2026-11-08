import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createPool } from '../../../infra/database/pool.js';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';
import { SkillsRepository } from '../infra/skills.repository.js';
import { SkillsCatalog, SkillsModule } from '../index.js';

describe('SkillsCatalog.visibleIds', () => {
  let database: TestDatabase;
  let catalog: SkillsCatalog;
  let close: () => Promise<void>;
  const ana = randomUUID();
  const bruno = randomUUID();
  let globalId: string;
  let anaPrivateId: string;
  let brunoPrivateId: string;

  const insertPrivate = async (owner: string, key: string): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      "insert into skills.skills (name, normalized_key, category, owner_user_id) values ($1, $1, 'tool', $2) returning id",
      [key, owner],
    );
    return row!.id;
  };

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_catalog');
    // The class the other slices receive from the module, on the real schema.
    const pool = createPool(database.url);
    catalog = new SkillsCatalog(new SkillsRepository(drizzle(pool)));
    close = () => pool.end();
    const [node] = await query<{ id: string }>(database.url, "select id from skills.skills where normalized_key = 'nodejs'");
    globalId = node!.id;
    anaPrivateId = await insertPrivate(ana, 'skillficticiaalfa');
    brunoPrivateId = await insertPrivate(bruno, 'skillficticiabeta');
  }, 120_000);

  afterAll(async () => {
    await close();
    await dropDatabase(inject('databaseUrl'), database);
  });

  it('SKL-58 is exported by the module index, which lets other modules inject it', () => {
    expect(Reflect.getMetadata('exports', SkillsModule)).toContain(SkillsCatalog);
  });

  it('SKL-58 returns the global ids and the own private ids', async () => {
    const visible = await catalog.visibleIds(ana, [globalId, anaPrivateId]);

    expect(visible).toEqual([globalId, anaPrivateId]);
  });

  it('SKL-59 leaves out the private skill of another person, an id that does not exist and text that is not a uuid', async () => {
    const unknown = randomUUID();

    const visible = await catalog.visibleIds(ana, [globalId, brunoPrivateId, unknown, 'not-a-uuid', '', anaPrivateId]);

    expect(visible).toEqual([globalId, anaPrivateId]);
    expect(await catalog.visibleIds(bruno, [anaPrivateId, brunoPrivateId])).toEqual([brunoPrivateId]);
  });

  it('SKL-59 answers an empty list for no ids and for ids none of which is visible', async () => {
    expect(await catalog.visibleIds(ana, [])).toEqual([]);
    expect(await catalog.visibleIds(ana, ['not-a-uuid', brunoPrivateId])).toEqual([]);
  });

  it('SKL-58 returns each visible id once, in the order given', async () => {
    expect(await catalog.visibleIds(ana, [anaPrivateId, globalId, anaPrivateId])).toEqual([anaPrivateId, globalId]);
  });
});
