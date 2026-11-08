import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createMigratedDatabase, dropDatabase, query, type TestDatabase } from '../../../../test/database.js';

const owner = '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60';

describe('applications schema', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createMigratedDatabase(inject('databaseUrl'), 'applications_schema');
  }, 60_000);

  afterAll(async () => {
    await dropDatabase(inject('databaseUrl'), database);
  });

  const insertPosting = async (): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      `insert into applications.job_postings (user_id, company, title, level, search_text, created_at)
       values ($1, 'Empresa Fictícia Alfa', 'Vaga de Teste Pleno', 'mid', 'empresa ficticia alfa vaga de teste pleno', now())
       returning id`,
      [owner],
    );
    return row!.id;
  };

  const insertApplication = async (postingId: string): Promise<string> => {
    const [row] = await query<{ id: string }>(
      database.url,
      `insert into applications.applications (user_id, job_posting_id, status, last_activity_at, created_at)
       values ($1, $2, 'saved', now(), now()) returning id`,
      [owner, postingId],
    );
    return row!.id;
  };

  const insertEvent = (applicationId: string, columns: string, values: string) =>
    query(
      database.url,
      `insert into applications.application_events (application_id, ${columns}, occurred_at, created_at)
       values ($1, ${values}, now(), now())`,
      [applicationId],
    );

  it('APP-07 holds no foreign key from the applications schema to another schema', async () => {
    const foreignKeys = await query<{ source_table: string; target_schema: string }>(
      database.url,
      `select source_table.relname as source_table, target_ns.nspname as target_schema
         from pg_constraint c
         join pg_class source_table on source_table.oid = c.conrelid
         join pg_namespace source_ns on source_ns.oid = source_table.relnamespace
         join pg_class target_table on target_table.oid = c.confrelid
         join pg_namespace target_ns on target_ns.oid = target_table.relnamespace
        where c.contype = 'f' and source_ns.nspname = 'applications'
        order by source_table.relname`,
    );

    // The foreign keys that exist stay inside the schema: skills of a posting, its application, the events.
    expect(foreignKeys.map((fk) => fk.source_table)).toEqual(['application_events', 'applications', 'job_posting_skills']);
    expect(foreignKeys.filter((fk) => fk.target_schema !== 'applications')).toEqual([]);
  });

  it('APP-07 keeps user_id, skill_id and submitted_document_id as plain uuid columns', async () => {
    const columns = await query<{ table_name: string; column_name: string; data_type: string }>(
      database.url,
      `select table_name, column_name, data_type from information_schema.columns
        where table_schema = 'applications'
          and column_name in ('user_id', 'skill_id', 'submitted_document_id')
        order by table_name, column_name`,
    );

    expect(columns).toEqual([
      { table_name: 'applications', column_name: 'submitted_document_id', data_type: 'uuid' },
      { table_name: 'applications', column_name: 'user_id', data_type: 'uuid' },
      { table_name: 'job_posting_skills', column_name: 'skill_id', data_type: 'uuid' },
      { table_name: 'job_postings', column_name: 'user_id', data_type: 'uuid' },
    ]);
  });

  it('gives a posting a uuid v7 id and refuses a second application for the same posting', async () => {
    const postingId = await insertPosting();
    await insertApplication(postingId);

    expect(postingId[14]).toBe('7');
    await expect(insertApplication(postingId)).rejects.toMatchObject({ code: '23505' });
  });

  it('refuses a status_changed event without to_status, a stage event without stage and a note event without note', async () => {
    const applicationId = await insertApplication(await insertPosting());

    await expect(insertEvent(applicationId, 'kind', "'status_changed'")).rejects.toMatchObject({ code: '23514' });
    await expect(insertEvent(applicationId, 'kind', "'stage'")).rejects.toMatchObject({ code: '23514' });
    await expect(insertEvent(applicationId, 'kind', "'note'")).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts a status_changed event without from_status (APP-02) and one with every field of its kind', async () => {
    const applicationId = await insertApplication(await insertPosting());

    await insertEvent(applicationId, 'kind, to_status', "'status_changed', 'applied'");
    await insertEvent(applicationId, 'kind, stage', "'stage', 'hr'");
    await insertEvent(applicationId, 'kind, note', "'note', 'Falei com a pessoa recrutadora'");

    const rows = await query<{ kind: string }>(database.url, 'select kind from applications.application_events where application_id = $1', [applicationId]);
    expect(rows.map((row) => row.kind).sort()).toEqual(['note', 'stage', 'status_changed']);
  });

  it('APP-36 deletes the skills, the application and its events with the posting, inside the schema', async () => {
    const postingId = await insertPosting();
    const applicationId = await insertApplication(postingId);
    await insertEvent(applicationId, 'kind, note', "'note', 'Nota fictícia'");
    await query(
      database.url,
      "insert into applications.job_posting_skills (job_posting_id, skill_id, requirement, position) values ($1, $2, 'required', 0)",
      [postingId, owner],
    );

    await query(database.url, 'delete from applications.job_postings where id = $1', [postingId]);

    expect(await query(database.url, 'select 1 from applications.applications where id = $1', [applicationId])).toEqual([]);
    expect(await query(database.url, 'select 1 from applications.application_events where application_id = $1', [applicationId])).toEqual([]);
    expect(await query(database.url, 'select 1 from applications.job_posting_skills where job_posting_id = $1', [postingId])).toEqual([]);
  });

  it('refuses the same skill twice on one posting', async () => {
    const postingId = await insertPosting();
    const add = () =>
      query(
        database.url,
        "insert into applications.job_posting_skills (job_posting_id, skill_id, requirement, position) values ($1, $2, 'required', 0)",
        [postingId, owner],
      );

    await add();
    await expect(add()).rejects.toMatchObject({ code: '23505' });
  });
});
