import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';

const ownerA = '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60';
const ownerB = '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f61';

describe('skills schema', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'skills_schema');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  const insertSkill = (key: string, owner: string | null) =>
    query(
      database.url,
      `insert into skills.skills (name, normalized_key, category, owner_user_id)
       values ($1, $2, 'tool', $3)`,
      [key, key, owner],
    );

  it('SKL-04 holds no foreign key from the skills schema to another schema', async () => {
    const foreignKeys = await query<{ source_table: string; target_schema: string }>(
      database.url,
      `select source_table.relname as source_table, target_ns.nspname as target_schema
         from pg_constraint c
         join pg_class source_table on source_table.oid = c.conrelid
         join pg_namespace source_ns on source_ns.oid = source_table.relnamespace
         join pg_class target_table on target_table.oid = c.confrelid
         join pg_namespace target_ns on target_ns.oid = target_table.relnamespace
        where c.contype = 'f' and source_ns.nspname = 'skills'`,
    );

    // The only foreign key is the alias pointing at its skill, inside the same schema.
    expect(foreignKeys).toEqual([{ source_table: 'skill_aliases', target_schema: 'skills' }]);
    expect(foreignKeys.filter((fk) => fk.target_schema !== 'skills')).toEqual([]);
  });

  it('SKL-04 keeps owner_user_id as a uuid column with no constraint', async () => {
    const column = await query<{ data_type: string; is_nullable: string }>(
      database.url,
      `select data_type, is_nullable from information_schema.columns
        where table_schema = 'skills' and table_name = 'skills' and column_name = 'owner_user_id'`,
    );
    expect(column).toEqual([{ data_type: 'uuid', is_nullable: 'YES' }]);
  });

  it('refuses two global skills with the same key', async () => {
    await insertSkill('globalkey', null);

    await expect(insertSkill('globalkey', null)).rejects.toMatchObject({ code: '23505' });
  });

  it('accepts the same key for different owners and refuses it twice for one owner', async () => {
    await insertSkill('sharedkey', ownerA);
    await insertSkill('sharedkey', ownerB);
    await insertSkill('sharedkey', null);

    await expect(insertSkill('sharedkey', ownerA)).rejects.toMatchObject({ code: '23505' });
  });

  it('refuses a normalized alias used twice and cascades aliases when the skill goes', async () => {
    await insertSkill('aliasowner', null);
    await insertSkill('aliasother', null);
    const [first] = await query<{ id: string }>(database.url, "select id from skills.skills where normalized_key = 'aliasowner'");
    const [second] = await query<{ id: string }>(database.url, "select id from skills.skills where normalized_key = 'aliasother'");
    const addAlias = (skillId: string) =>
      query(database.url, "insert into skills.skill_aliases (skill_id, alias, normalized_alias) values ($1, 'Nick', 'nick')", [skillId]);

    await addAlias(first!.id);
    await expect(addAlias(second!.id)).rejects.toMatchObject({ code: '23505' });

    await query(database.url, 'delete from skills.skills where id = $1', [first!.id]);
    expect(await query(database.url, "select id from skills.skill_aliases where normalized_alias = 'nick'")).toEqual([]);
  });

  it('indexes owner_user_id', async () => {
    const indexes = await query<{ indexname: string }>(
      database.url,
      "select indexname from pg_indexes where schemaname = 'skills' and tablename = 'skills' order by indexname",
    );
    expect(indexes.map((i) => i.indexname)).toContain('skills_owner_user_id_index');
  });
});
