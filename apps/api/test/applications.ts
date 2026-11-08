import { randomUUID } from 'node:crypto';
import { inject } from 'vitest';
import { searchTextOf } from '../src/modules/applications/domain/search-text.js';
import { startApi } from './api.js';
import { asAccount, createAccount, type TestAccount } from './accounts.js';
import { testClock, type TestClock } from './clock.js';
import { createMigratedDatabase, dropDatabase, query } from './database.js';

type Api = Awaited<ReturnType<typeof startApi>>;

/** Everything an integration test of `/applications` needs: a real API on its own database, two members and an admin. */
export interface ApplicationsEnv {
  api: Api;
  databaseUrl: string;
  clock: TestClock;
  ana: TestAccount;
  bruno: TestAccount;
  admin: TestAccount;
}

/** Starts the API with a clock the test moves; `close` stops it and drops the database. Use it for a suite that shares its data. */
export async function startApplicationsEnv(prefix: string): Promise<ApplicationsEnv & { close: () => Promise<void> }> {
  const database = await createMigratedDatabase(inject('databaseUrl'), prefix);
  const clock = testClock();
  const api = await startApi(database.url, { clock });
  try {
    return {
      api,
      databaseUrl: database.url,
      clock,
      ana: await createAccount(database.url, api.baseUrl, `ana.${prefix}@example.com`, 'member'),
      bruno: await createAccount(database.url, api.baseUrl, `bruno.${prefix}@example.com`, 'member'),
      admin: await createAccount(database.url, api.baseUrl, `admin.${prefix}@example.com`, 'admin'),
      close: async () => {
        await api.close();
        await dropDatabase(inject('databaseUrl'), database);
      },
    };
  } catch (error) {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
    throw error;
  }
}

/** Starts the environment for one test and tears it down when `run` ends. */
export async function withApplicationsEnv(prefix: string, run: (env: ApplicationsEnv) => Promise<void>): Promise<void> {
  const env = await startApplicationsEnv(prefix);
  try {
    await run(env);
  } finally {
    await env.close();
  }
}

export interface SeedRow {
  userId: string;
  company?: string;
  title?: string;
  level?: string;
  workModel?: string | null;
  status?: string;
  createdAt?: string;
  lastActivityAt?: string;
  skills?: Array<{ skillId: string; requirement: 'required' | 'nice_to_have' }>;
}

/**
 * Writes postings, their skills and applications straight into the database in three statements, so a
 * test can make dates, statuses and ties the API would not. Answers the application ids in the order of `rows`.
 */
export async function seedApplications(databaseUrl: string, rows: SeedRow[]): Promise<string[]> {
  const records = rows.map((row) => {
    const company = row.company ?? 'Empresa Fictícia Alfa';
    const title = row.title ?? 'Vaga de Teste Pleno';
    const createdAt = row.createdAt ?? '2026-11-03T12:00:00.000Z';
    return {
      postingId: randomUUID(),
      applicationId: randomUUID(),
      userId: row.userId,
      company,
      title,
      level: row.level ?? 'mid',
      workModel: row.workModel ?? null,
      searchText: searchTextOf(company, title),
      createdAt,
      status: row.status ?? 'saved',
      lastActivityAt: row.lastActivityAt ?? createdAt,
      skills: row.skills ?? [],
    };
  });
  await query(
    databaseUrl,
    `insert into applications.job_postings (id, user_id, company, title, level, work_model, search_text, created_at)
     select r.id, r.user_id, r.company, r.title, r.level::applications.job_level, r.work_model::applications.work_model, r.search_text, r.created_at
       from jsonb_to_recordset($1::jsonb) as r(id uuid, user_id uuid, company text, title text, level text, work_model text, search_text text, created_at timestamptz)`,
    [
      JSON.stringify(
        records.map((r) => ({ id: r.postingId, user_id: r.userId, company: r.company, title: r.title, level: r.level, work_model: r.workModel, search_text: r.searchText, created_at: r.createdAt })),
      ),
    ],
  );
  const skillRows = records.flatMap((r) =>
    r.skills.map((skill, position) => ({ job_posting_id: r.postingId, skill_id: skill.skillId, requirement: skill.requirement, position })),
  );
  if (skillRows.length > 0) {
    await query(
      databaseUrl,
      `insert into applications.job_posting_skills (job_posting_id, skill_id, requirement, position)
       select r.job_posting_id, r.skill_id, r.requirement::applications.skill_requirement, r.position
         from jsonb_to_recordset($1::jsonb) as r(job_posting_id uuid, skill_id uuid, requirement text, position int)`,
      [JSON.stringify(skillRows)],
    );
  }
  await query(
    databaseUrl,
    `insert into applications.applications (id, user_id, job_posting_id, status, last_activity_at, created_at)
     select r.id, r.user_id, r.job_posting_id, r.status::applications.application_status, r.last_activity_at, r.created_at
       from jsonb_to_recordset($1::jsonb) as r(id uuid, user_id uuid, job_posting_id uuid, status text, last_activity_at timestamptz, created_at timestamptz)`,
    [
      JSON.stringify(
        records.map((r) => ({ id: r.applicationId, user_id: r.userId, job_posting_id: r.postingId, status: r.status, last_activity_at: r.lastActivityAt, created_at: r.createdAt })),
      ),
    ],
  );
  return records.map((r) => r.applicationId);
}

/** One application, written like `seedApplications` does. */
export async function seedApplication(databaseUrl: string, row: SeedRow): Promise<string> {
  return (await seedApplications(databaseUrl, [row]))[0]!;
}

/** One call to the API as `account`; no account means no session cookie. */
export function call(
  env: Pick<ApplicationsEnv, 'api'>,
  account: TestAccount | undefined,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${env.api.baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(account === undefined ? {} : asAccount(account)) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A valid `POST /applications` body with fictional data; `jobPosting` fields and the rest can be overridden. */
export function applicationBody(
  jobPosting: Record<string, unknown> = {},
  rest: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    jobPosting: { company: 'Empresa Fictícia Alfa', title: 'Vaga de Teste Pleno', level: 'mid', ...jobPosting },
    ...rest,
  };
}
