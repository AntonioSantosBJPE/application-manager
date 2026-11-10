import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';

const owner = '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60';

describe('resume schema', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'resume_schema');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  const insertExperience = async (): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      `insert into resume.experiences (user_id, role, company, start_date, position)
       values ($1, 'Desenvolvedora', 'Empresa Fictícia Alfa', '2021-01-01', 0) returning id`,
      [owner],
    );
    return row!.id;
  };

  const insertProject = async (): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      "insert into resume.projects (user_id, name, position) values ($1, 'Projeto Fictício', 0) returning id",
      [owner],
    );
    return row!.id;
  };

  const insertBullet = (experienceId: string | null, projectId: string | null) =>
    query(
      database.url,
      "insert into resume.bullets (user_id, experience_id, project_id, text, position) values ($1, $2, $3, 'Fiz algo.', 0)",
      [owner, experienceId, projectId],
    );

  it('RES-31 holds no foreign key from the resume schema to another schema', async () => {
    const foreignKeys = await query<{ source_table: string; target_table: string; target_schema: string; on_delete: string }>(
      database.url,
      `select source_table.relname as source_table, target_table.relname as target_table,
              target_ns.nspname as target_schema, c.confdeltype as on_delete
         from pg_constraint c
         join pg_class source_table on source_table.oid = c.conrelid
         join pg_namespace source_ns on source_ns.oid = source_table.relnamespace
         join pg_class target_table on target_table.oid = c.confrelid
         join pg_namespace target_ns on target_ns.oid = target_table.relnamespace
        where c.contype = 'f' and source_ns.nspname = 'resume'
        order by target_table.relname`,
    );

    // The only foreign keys are the bullets' two parents, inside the schema, and both cascade ('c').
    expect(foreignKeys).toEqual([
      { source_table: 'bullets', target_table: 'experiences', target_schema: 'resume', on_delete: 'c' },
      { source_table: 'bullets', target_table: 'projects', target_schema: 'resume', on_delete: 'c' },
    ]);
  });

  it('RES-31 keeps user_id as a plain uuid column in every table that has one', async () => {
    const columns = await query<{ table_name: string; data_type: string }>(
      database.url,
      `select table_name, data_type from information_schema.columns
        where table_schema = 'resume' and column_name = 'user_id' order by table_name`,
    );

    expect(columns).toEqual(
      ['bullets', 'certifications', 'educations', 'experiences', 'languages', 'profiles', 'projects'].map((table_name) => ({
        table_name,
        data_type: 'uuid',
      })),
    );
  });

  it('RES-06 refuses a second profile for the same user', async () => {
    const add = () =>
      query(database.url, 'insert into resume.profiles (user_id, updated_at) values ($1, now())', [owner]);

    await add();
    await expect(add()).rejects.toMatchObject({ code: '23505' });
  });

  it('RES-01 gives a profile the empty defaults and the pt-BR locale', async () => {
    const other = '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f61';
    const [row] = await query<{ full_name: string; links: unknown; locale: string }>(
      database.url,
      'insert into resume.profiles (user_id, updated_at) values ($1, now()) returning full_name, links, locale',
      [other],
    );

    expect(row).toEqual({ full_name: '', links: [], locale: 'pt-BR' });
  });

  it('refuses a bullet with both parents and a bullet with neither', async () => {
    const experienceId = await insertExperience();
    const projectId = await insertProject();

    await expect(insertBullet(experienceId, projectId)).rejects.toMatchObject({ code: '23514' });
    await expect(insertBullet(null, null)).rejects.toMatchObject({ code: '23514' });
  });

  it('RES-09 deletes the bullets of an experience and of a project with it, and keeps the others', async () => {
    const experienceId = await insertExperience();
    const keptId = await insertExperience();
    const projectId = await insertProject();
    await insertBullet(experienceId, null);
    await insertBullet(keptId, null);
    await insertBullet(null, projectId);

    await query(database.url, 'delete from resume.experiences where id = $1', [experienceId]);
    await query(database.url, 'delete from resume.projects where id = $1', [projectId]);

    expect(await query(database.url, 'select 1 from resume.bullets where experience_id = $1', [experienceId])).toEqual([]);
    expect(await query(database.url, 'select 1 from resume.bullets where project_id = $1', [projectId])).toEqual([]);
    expect(await query(database.url, 'select 1 from resume.bullets where experience_id = $1', [keptId])).toHaveLength(1);
  });

  it('keeps the skills of a bullet in the order they were marked', async () => {
    const experienceId = await insertExperience();
    const first = '0195f3a0-0000-7000-8000-000000000002';
    const second = '0195f3a0-0000-7000-8000-000000000001';
    const [row] = await query<{ skill_ids: string[] }>(
      database.url,
      "insert into resume.bullets (user_id, experience_id, text, skill_ids, position) values ($1, $2, 'Fiz algo.', $3, 0) returning skill_ids",
      [owner, experienceId, [first, second]],
    );

    expect(row!.skill_ids).toEqual([first, second]);
  });
});
