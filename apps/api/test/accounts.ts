import { argon2idPasswordHasher } from '../src/modules/identity/index.js';
import { query } from './database.js';

export const accountPassword = 'correct-horse-battery';

let passwordHash: Promise<string> | undefined;

export interface TestAccount {
  id: string;
  email: string;
  /** Value of the session cookie, ready for the `cookie` header as `am_session=<token>`. */
  token: string;
}

/** Creates an account straight in the database and signs it in through the API, as a real client does. */
export async function createAccount(
  databaseUrl: string,
  baseUrl: string,
  email: string,
  role: 'admin' | 'member',
): Promise<TestAccount> {
  passwordHash ??= argon2idPasswordHasher.hash(accountPassword);
  const [row] = await query<{ id: string }>(
    databaseUrl,
    'insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, $4) returning id',
    [email, role === 'admin' ? 'Admin' : 'Ana', await passwordHash, role],
  );
  const response = await fetch(`${baseUrl}${role === 'admin' ? '/auth/admin/login' : '/auth/login'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: accountPassword }),
  });
  if (response.status !== 204) throw new Error(`Sign-in of ${email} answered ${response.status}`);
  const token = /^am_session=([^;]+)/.exec(response.headers.get('set-cookie') ?? '')?.[1];
  if (token === undefined) throw new Error(`Sign-in of ${email} set no session cookie`);
  return { id: row!.id, email, token };
}

export const asAccount = (account: TestAccount) => ({ cookie: `am_session=${account.token}` });
