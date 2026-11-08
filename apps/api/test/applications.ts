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

/** Writes a posting, its skills and an application straight into the database, so a test can make dates and statuses the API would not. */
export async function seedApplication(databaseUrl: string, row: SeedRow): Promise<string> {
  const company = row.company ?? 'Empresa Fictícia Alfa';
  const title = row.title ?? 'Vaga de Teste Pleno';
  const createdAt = row.createdAt ?? '2026-11-03T12:00:00.000Z';
  const [posting] = await query<{ id: string }>(
    databaseUrl,
    `insert into applications.job_postings (user_id, company, title, level, work_model, search_text, created_at)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [row.userId, company, title, row.level ?? 'mid', row.workModel ?? null, searchTextOf(company, title), createdAt],
  );
  for (const [position, skill] of (row.skills ?? []).entries()) {
    await query(
      databaseUrl,
      'insert into applications.job_posting_skills (job_posting_id, skill_id, requirement, position) values ($1, $2, $3, $4)',
      [posting!.id, skill.skillId, skill.requirement, position],
    );
  }
  const [application] = await query<{ id: string }>(
    databaseUrl,
    `insert into applications.applications (user_id, job_posting_id, status, last_activity_at, created_at)
     values ($1, $2, $3, $4, $5) returning id`,
    [row.userId, posting!.id, row.status ?? 'saved', row.lastActivityAt ?? createdAt, createdAt],
  );
  return application!.id;
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
