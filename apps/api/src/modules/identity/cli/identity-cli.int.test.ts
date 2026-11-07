import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { drizzle } from 'drizzle-orm/node-postgres';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { promptHidden } from './hidden-prompt.js';
import { runIdentityCli } from './run-identity-cli.js';
import { createPool } from '../../../infra/database/pool.js';
import { createMigratedDatabase, dropDatabase, query } from '../../../../test/database.js';

const apiRoot = join(import.meta.dirname, '../../../..');
const entrypoint = join(apiRoot, 'dist', 'cli.js');

const password = 'correct-horse-battery';
const newPassword = 'novo-cavalo-bateria';

type Database = Awaited<ReturnType<typeof createMigratedDatabase>>;

interface CliAnswer {
  code: number;
  stdout: string;
  stderr: string;
}

/** The compiled entrypoint, built once so the test runs the file the image ships. */
function buildEntrypoint(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['build'], { cwd: apiRoot });
    let output = '';
    // A build that fails must say why: swallowing its streams turns a compile error into a bare exit code.
    child.stdout.on('data', (chunk) => {
      output += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      output += String(chunk);
    });
    child.on('error', (error) => reject(new Error(`build could not start: ${error.message}`)));
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`build exited with ${code}\n${output}`)),
    );
  });
}

/**
 * Runs the compiled entrypoint the way an operator does: `node dist/cli.js <args>` against a real
 * Postgres, with the password reaching it on standard input (CLI-06).
 */
function cliAt(databaseUrl: string, args: string[], stdin = ''): Promise<CliAnswer> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [entrypoint, ...args], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl, LOG_LEVEL: 'error' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.stdin.end(stdin);
  });
}

function cli(database: Database, args: string[], stdin = ''): Promise<CliAnswer> {
  return cliAt(database.url, args, stdin);
}

/** Runs the command in process, with a prompt the test answers and a standard input of its own. */
async function runWithPrompt(
  database: Database,
  args: string[],
  options: { stdin: string; answer: string },
): Promise<{ code: number; prompts: string[]; stdout: string; stderr: string }> {
  const pool = createPool(database.url);
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = '';
  let err = '';
  stdout.on('data', (chunk) => {
    out += String(chunk);
  });
  stderr.on('data', (chunk) => {
    err += String(chunk);
  });
  const prompts: string[] = [];
  stdin.end(options.stdin);
  try {
    const code = await runIdentityCli(args, {
      db: drizzle(pool),
      stdin,
      stdout,
      stderr,
      promptPassword: async (question) => {
        prompts.push(question);
        return options.answer;
      },
    });
    return { code, prompts, stdout: out, stderr: err };
  } finally {
    await pool.end();
  }
}

async function usersOf(databaseUrl: string) {
  return query<{ id: string; email: string; name: string; role: string; password_hash: string }>(
    databaseUrl,
    'select id, email, name, role, password_hash from identity.users order by email',
  );
}

async function withDatabase(runTest: (database: Database) => Promise<void>) {
  const database = await createMigratedDatabase(inject('databaseUrl'), 'identity_cli');
  try {
    await runTest(database);
  } finally {
    await dropDatabase(inject('databaseUrl'), database);
  }
}

/**
 * A stream `promptHidden` sees as a terminal. `isTTY` is what readline reads to decide that what is
 * typed is echoed back, so flagging a pair of pipes is the portable half of a pty: no dependency, and
 * the same code path on macOS and Linux. The typed answer is written into `input`; everything the
 * prompt writes while it waits lands in `written`.
 */
function terminalStreams(question: string) {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; setRawMode: (mode: boolean) => void };
  input.isTTY = true;
  // Readline calls this on a terminal; the stream is not one, so the call does nothing.
  input.setRawMode = () => {};
  const output = new PassThrough();
  let written = question;
  output.on('data', (chunk) => {
    written += String(chunk);
  });
  return { input, output, written: () => written };
}

describe('identity cli', () => {
  // The entrypoint under test is the one the image runs, so it is compiled before the first call.
  beforeAll(async () => {
    await buildEntrypoint();
  }, 180_000);

  it('create-admin creates a lowercase admin and exits 0', async () => {
    await withDatabase(async (database) => {
      const answer = await cli(database, ['create-admin', '--email', '  Admin.Novo@Example.COM ', '--name', 'Admin Novo', '--password-stdin'], `${password}\n`);

      expect({ code: answer.code, stderr: answer.stderr }).toEqual({ code: 0, stderr: '' });
      const users = await usersOf(database.url);
      const [user] = users;
      // The account exists once, lowercased, as an admin, and the password is only its hash (CLI-01).
      expect(users).toHaveLength(1);
      expect(user!.email).toBe('admin.novo@example.com');
      expect(user!.role).toBe('admin');
      expect(user!.name).toBe('Admin Novo');
      expect(user!.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      await expect(argon2idPasswordHasher.verify(user!.password_hash, password)).resolves.toBe(true);
      // Neither the password nor the hash is ever printed.
      expect(answer.stdout).not.toContain(password);
      expect(answer.stderr).not.toContain(password);
      expect(answer.stdout).not.toContain(user!.password_hash);
    });
  });

  it('create-admin refuses an existing email in any role', async () => {
    await withDatabase(async (database) => {
      expect((await cli(database, ['create-admin', '--email', 'admin.a@example.com', '--name', 'Admin A', '--password-stdin'], `${password}\n`)).code).toBe(0);
      // An account of the other role holds the second address: the refusal is about the email (CLI-02).
      await query(
        database.url,
        "insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member')",
        ['member.b@example.com', 'Member B', await argon2idPasswordHasher.hash(password)],
      );
      const before = await usersOf(database.url);

      const adminTaken = await cli(database, ['create-admin', '--email', 'admin.a@example.com', '--name', 'Outro', '--password-stdin'], `${newPassword}\n`);
      const memberTaken = await cli(database, ['create-admin', '--email', 'member.b@example.com', '--name', 'Outro', '--password-stdin'], `${newPassword}\n`);

      expect(adminTaken.code).not.toBe(0);
      expect(memberTaken.code).not.toBe(0);
      // Not one row changed: no new account, no new name, no new hash.
      expect(await usersOf(database.url)).toEqual(before);
    });
  });

  it('reset-password changes the hash keeps the role and revokes every session', async () => {
    await withDatabase(async (database) => {
      const [created] = await query<{ id: string }>(
        database.url,
        "insert into identity.users (email, name, password_hash, role) values ($1, $2, $3, 'member') returning id",
        ['member.reset@example.com', 'Member Reset', await argon2idPasswordHasher.hash(password)],
      );
      for (const hash of ['hash-one', 'hash-two']) {
        await query(
          database.url,
          "insert into identity.sessions (user_id, token_hash, expires_at) values ($1, $2, now() + interval '30 days')",
          [created!.id, hash],
        );
      }
      const [before] = await usersOf(database.url);

      const answer = await cli(database, ['reset-password', '--email', 'member.reset@example.com', '--password-stdin'], `${newPassword}\n`);

      expect(answer.code).toBe(0);
      const [after] = await usersOf(database.url);
      // Same account, same role, a new hash that only the new password verifies (CLI-03).
      expect(after!.id).toBe(before!.id);
      expect(after!.role).toBe('member');
      expect(after!.password_hash).not.toBe(before!.password_hash);
      await expect(argon2idPasswordHasher.verify(after!.password_hash, newPassword)).resolves.toBe(true);
      await expect(argon2idPasswordHasher.verify(after!.password_hash, password)).resolves.toBe(false);

      const sessions = await query<{ revoked_at: Date | null }>(
        database.url,
        'select revoked_at from identity.sessions where user_id = $1',
        [created!.id],
      );
      expect(sessions).toHaveLength(2);
      expect(sessions.every((session) => session.revoked_at !== null)).toBe(true);
    });
  });

  it('reset-password refuses an unknown email without creating a user', async () => {
    await withDatabase(async (database) => {
      const answer = await cli(database, ['reset-password', '--email', 'ninguem@example.com', '--password-stdin'], `${newPassword}\n`);

      expect(answer.code).not.toBe(0);
      expect(await usersOf(database.url)).toEqual([]);
    });
  });

  it('refuses passwords of 11 and 129 characters without writing', async () => {
    await withDatabase(async (database) => {
      const short = await cli(database, ['create-admin', '--email', 'curta@example.com', '--name', 'Curta', '--password-stdin'], `${'a'.repeat(11)}\n`);
      const long = await cli(database, ['create-admin', '--email', 'longa@example.com', '--name', 'Longa', '--password-stdin'], `${'a'.repeat(129)}\n`);

      expect([short.code, long.code]).toEqual([2, 2]);
      // The rule is checked before any table is touched, so neither refusal left a row (CLI-05).
      expect(await usersOf(database.url)).toEqual([]);

      // Control: 12 characters go through, so the refusals are about the length and nothing else.
      const exact = await cli(database, ['create-admin', '--email', 'exata@example.com', '--name', 'Exata', '--password-stdin'], `${'a'.repeat(12)}\n`);
      expect(exact.code).toBe(0);
      expect((await usersOf(database.url)).map((user) => user.email)).toEqual(['exata@example.com']);
    });
  });

  it('refuses an invalid email, a blank or oversized name and an unknown flag without writing', async () => {
    await withDatabase(async (database) => {
      // The contract the API uses is the one the operator is held to, so a typed address is checked
      // before anything is written and never becomes an account (CLI-01, EDGE-01).
      const badEmail = await cli(
        database,
        ['create-admin', '--email', 'nao-e-um-email', '--name', 'Alguém', '--password-stdin'],
        `${password}\n`,
      );
      const blankName = await cli(
        database,
        ['create-admin', '--email', 'nome.vazio@example.com', '--name', '   ', '--password-stdin'],
        `${password}\n`,
      );
      const longName = await cli(
        database,
        ['create-admin', '--email', 'nome.longo@example.com', '--name', 'a'.repeat(121), '--password-stdin'],
        `${password}\n`,
      );
      // A misspelled flag is a usage error, not a value the command silently ignores.
      const unknownFlag = await cli(
        database,
        ['create-admin', '--email', 'flag@example.com', '--name', 'Flag', '--role', 'admin', '--password-stdin'],
        `${password}\n`,
      );

      expect([badEmail.code, blankName.code, longName.code, unknownFlag.code]).toEqual([2, 2, 2, 2]);
      expect(unknownFlag.stderr).toContain('unknown flag: --role');
      expect(await usersOf(database.url)).toEqual([]);

      // Control: the same command with a valid email and a name of exactly 120 characters goes through.
      const accepted = await cli(
        database,
        ['create-admin', '--email', '  Valido@Example.COM ', '--name', `  ${'a'.repeat(120)}  `, '--password-stdin'],
        `${password}\n`,
      );
      expect(accepted.code).toBe(0);
      const [user] = await usersOf(database.url);
      expect(user!.email).toBe('valido@example.com');
      // The name is stored trimmed, the way the contract shapes it.
      expect(user!.name).toBe('a'.repeat(120));
    });
  });

  it('keeps a name with an equals sign whole and trims it', async () => {
    await withDatabase(async (database) => {
      // Only the first `=` separates the flag from its value, so `A=B` is the name and not `A`.
      const answer = await cli(
        database,
        ['create-admin', '--email=nome.igual@example.com', '--name=A=B', '--password-stdin'],
        `${password}\n`,
      );

      expect({ code: answer.code, stderr: answer.stderr }).toEqual({ code: 0, stderr: '' });
      const [user] = await usersOf(database.url);
      expect(user!.name).toBe('A=B');
    });
  });

  it('refuses with a usage error instead of hanging when the prompt finds standard input closed', async () => {
    await withDatabase(async (database) => {
      const answer = await cli(database, ['create-admin', '--email', 'closed-stdin@example.com', '--name', 'Closed']);

      expect(answer.code).toBe(2);
      expect(answer.stderr).toContain('password must have between 12 and 128 characters');
      expect(await usersOf(database.url)).toEqual([]);
    });
  });

  it('reads the password from stdin and rejects it as an argument', async () => {
    await withDatabase(async (database) => {
      // A password in argv is readable by `ps` and lands in shell history, so the CLI refuses it (CLI-06).
      const asArgument = await cli(database, ['create-admin', '--email', 'argv@example.com', '--name', 'Argv', '--password', password]);
      const inlineArgument = await cli(database, ['create-admin', '--email', 'argv@example.com', '--name', 'Argv', `--password=${password}`]);
      expect([asArgument.code, inlineArgument.code]).toEqual([2, 2]);
      expect(await usersOf(database.url)).toEqual([]);

      // From standard input, the same command works.
      const fromStdin = await cli(database, ['create-admin', '--email', 'stdin@example.com', '--name', 'Stdin', '--password-stdin'], `${password}\n`);
      expect(fromStdin.code).toBe(0);
      expect((await usersOf(database.url)).map((user) => user.email)).toEqual(['stdin@example.com']);

      // An unknown subcommand and a missing variable are usage errors, not silent successes.
      expect((await cli(database, ['drop-table'])).code).toBe(2);
      expect((await cli(database, ['create-admin', '--name', 'Sem Email', '--password-stdin'], `${password}\n`)).code).toBe(2);

      // The hidden prompt itself, over a stream flagged as a terminal: what is typed reaches the
      // command and never comes back out, so a screen share or a terminal log holds no password (CLI-06).
      const streams = terminalStreams('Password: ');
      const prompted = promptHidden('Password: ', streams);
      setImmediate(() => streams.input.write(`${password}\n`));

      await expect(prompted).resolves.toBe(password);
      expect(streams.written()).toContain('Password: ');
      expect(streams.written()).not.toContain(password);
    });
  });

  it('prints one line and exits 1 when the database is unreachable', async () => {
    // A port nothing listens on: the command fails at the first query, after hashing the password.
    // The hash is credential material, so the message cannot carry the driver's error, whose own
    // message repeats the query parameters (AUTH-18).
    const answer = await cliAt('postgres://nobody:nobody@127.0.0.1:1/nothing', [
      'create-admin',
      '--email',
      'sem-banco@example.com',
      '--name',
      'Sem Banco',
      '--password-stdin',
    ], `${password}\n`);

    expect(answer.code).toBe(1);
    expect(answer.stderr).not.toContain(password);
    // Neither the Argon2id hash of the password nor the driver's parameter list reaches the log.
    expect(answer.stderr).not.toMatch(/\$argon2id\$/);
    expect(answer.stderr).not.toContain('params:');
    expect(answer.stderr).not.toContain('sem-banco@example.com');
    expect(answer.stderr).not.toContain('Failed query');
    // One line, so a container log shows a refusal and not a stack trace.
    expect(answer.stderr.trim().split('\n')).toHaveLength(1);
    expect(answer.stdout).toBe('');
  }, 120_000);

  it('without --password-stdin reads the password only from the prompt', async () => {    await withDatabase(async (database) => {
      const prompted = await runWithPrompt(database, ['create-admin', '--email', 'prompt@example.com', '--name', 'Prompt'], {
        // Standard input carries something else entirely; only what the prompt asks for is used (CLI-06).
        stdin: `${password}\n`,
        answer: newPassword,
      });

      expect(prompted.code).toBe(0);
      expect(prompted.prompts).toEqual(['Password: ']);
      const [user] = await usersOf(database.url);
      await expect(argon2idPasswordHasher.verify(user!.password_hash, newPassword)).resolves.toBe(true);
      await expect(argon2idPasswordHasher.verify(user!.password_hash, password)).resolves.toBe(false);

      // With `--password-stdin` the prompt is never opened, so a terminal is not needed in a container.
      const fromStdin = await runWithPrompt(database, ['reset-password', '--email', 'prompt@example.com', '--password-stdin'], {
        stdin: `${password}\n`,
        answer: newPassword,
      });
      expect(fromStdin.code).toBe(0);
      expect(fromStdin.prompts).toEqual([]);
      const [reset] = await usersOf(database.url);
      await expect(argon2idPasswordHasher.verify(reset!.password_hash, password)).resolves.toBe(true);
    });
  });
});
