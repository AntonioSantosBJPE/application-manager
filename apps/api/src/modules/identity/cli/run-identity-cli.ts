import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Readable, Writable } from 'node:stream';
import { AccountAdminService } from '../application/account-admin.service.js';
import { argon2idPasswordHasher } from '../application/password-hasher.js';
import { SessionService } from '../application/session.service.js';
import { isAcceptablePassword, normalizeEmail } from '../domain/credentials.js';
import { systemClock } from '../../../infra/clock/clock.js';
import { SessionsRepository } from '../infra/sessions.repository.js';
import { UsersRepository } from '../infra/users.repository.js';

/** 0 when the command did what it was asked; the other codes are below. */
export const EXIT_OK = 0;
/** The command was understood and refused: the email is taken, or no account has it. */
export const EXIT_REFUSED = 1;
/** The command itself was wrong: unknown subcommand, missing variable, password outside the rule. */
export const EXIT_USAGE = 2;

/** What the CLI needs from the outside world, so a test drives it without a terminal. */
export interface CliIo {
  /** The database the command writes to; the CLI runs without the Nest container. */
  db: NodePgDatabase;
  /** Raw standard input; the password is read from it only with `--password-stdin`. */
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
  /** The hidden prompt: what is typed is never echoed, and never written to a log (CLI-06). */
  promptPassword: (question: string) => Promise<string>;
}

/** The usage line the CLI prints when the arguments do not make a command. */
const usage = [
  'usage:',
  '  identity create-admin --email <email> --name <name> [--password-stdin]',
  '  identity reset-password --email <email> [--password-stdin]',
  '',
  'Without --password-stdin the password is asked in a hidden prompt.',
].join('\n');

interface ParsedArguments {
  command: { kind: 'create-admin' | 'reset-password' };
  email: string;
  name?: string;
  passwordFromStdin: boolean;
}

/** `undefined` with a message when the arguments are not a command: unknown flags, missing values. */
function parse(argv: string[]): { ok: true; value: ParsedArguments } | { ok: false; error: string } {
  const [command, ...rest] = argv;
  if (command !== 'create-admin' && command !== 'reset-password') {
    return { ok: false, error: command === undefined ? 'missing subcommand' : `unknown subcommand: ${command}` };
  }

  const flags = new Map<string, string>();
  let passwordFromStdin = false;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index]!;
    if (flag === '--password-stdin') {
      passwordFromStdin = true;
      continue;
    }
    if (flag === '--password' || flag.startsWith('--password=')) {
      // A password in argv is visible to `ps` and shell history, so the CLI never accepts one (CLI-06).
      return { ok: false, error: 'refusing a password on the command line: use --password-stdin or the prompt' };
    }
    if (!flag.startsWith('--')) return { ok: false, error: `unexpected argument: ${flag}` };
    const [name, inlineValue] = flag.split('=');
    const value = inlineValue ?? rest[++index];
    if (value === undefined) return { ok: false, error: `missing value for ${name}` };
    flags.set(name!, value);
  }

  const email = flags.get('--email');
  if (email === undefined || email.trim() === '') return { ok: false, error: 'missing --email' };
  if (command === 'reset-password' && flags.has('--name')) {
    return { ok: false, error: 'reset-password does not take --name; it keeps the account as it is' };
  }
  const name = flags.get('--name');
  if (command === 'create-admin' && (name === undefined || name.trim() === '')) {
    return { ok: false, error: 'missing --name' };
  }
  return { ok: true, value: { command: { kind: command }, email, name, passwordFromStdin } };
}

/** Everything standard input carries, read once: the caller sends the password and end-of-file. */
async function readAll(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * The account commands the operator runs (CLI-01..CLI-06). They exist outside the HTTP surface on
 * purpose: creating an admin and changing a password are never routes (CLI-07).
 *
 * The password comes from a hidden prompt or from `--password-stdin`, never from an argument, and it
 * is checked against the rule before any table is touched (CLI-05, CLI-06). Nothing the command
 * writes repeats it.
 */
export async function runIdentityCli(argv: string[], io: CliIo): Promise<number> {
  const parsed = parse(argv);
  if (!parsed.ok) {
    io.stderr.write(`${parsed.error}\n${usage}\n`);
    return EXIT_USAGE;
  }
  const input = parsed.value;

  const password = input.passwordFromStdin
    ? (await readAll(io.stdin)).split('\n')[0]!.replace(/\r$/, '')
    : await io.promptPassword('Password: ');
  if (!isAcceptablePassword(password)) {
    // The rule is checked before anything is written, so a short or long password changes no table (CLI-05).
    io.stderr.write('password must have between 12 and 128 characters\n');
    return EXIT_USAGE;
  }

  const users = new UsersRepository(io.db);
  const service = new AccountAdminService(
    users,
    new SessionService(new SessionsRepository(io.db), systemClock),
    argon2idPasswordHasher,
  );

  if (input.command.kind === 'create-admin') {
    const result = await service.createAdmin({ email: input.email, name: input.name!, password });
    if (!result.ok) {
      io.stderr.write(`an account already uses ${normalizeEmail(input.email)}\n`);
      return EXIT_REFUSED;
    }
    io.stdout.write(`admin created: ${result.user.email}\n`);
    return EXIT_OK;
  }

  const result = await service.resetPassword({ email: input.email, password });
  if (!result.ok) {
    io.stderr.write(`no account uses ${normalizeEmail(input.email)}\n`);
    return EXIT_REFUSED;
  }
  io.stdout.write(`password changed: ${result.user.email}; every session of the account was revoked\n`);
  return EXIT_OK;
}
