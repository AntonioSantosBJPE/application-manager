import { inject } from 'vitest';
import { startApi } from './api.js';
import { asAccount, createAccount, type TestAccount } from './accounts.js';
import { testClock, type TestClock } from './clock.js';
import { createMigratedDatabase, dropDatabase } from './database.js';

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

/** Starts the API with a clock the test moves; the database is dropped when `run` ends. */
export async function withApplicationsEnv(prefix: string, run: (env: ApplicationsEnv) => Promise<void>): Promise<void> {
  const database = await createMigratedDatabase(inject('databaseUrl'), prefix);
  const clock = testClock();
  const api = await startApi(database.url, { clock });
  try {
    await run({
      api,
      databaseUrl: database.url,
      clock,
      ana: await createAccount(database.url, api.baseUrl, `ana.${prefix}@example.com`, 'member'),
      bruno: await createAccount(database.url, api.baseUrl, `bruno.${prefix}@example.com`, 'member'),
      admin: await createAccount(database.url, api.baseUrl, `admin.${prefix}@example.com`, 'admin'),
    });
  } finally {
    await api.close();
    await dropDatabase(inject('databaseUrl'), database);
  }
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
