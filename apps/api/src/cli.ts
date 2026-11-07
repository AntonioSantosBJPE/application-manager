import 'reflect-metadata';
import { stdin, stdout } from 'node:process';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadDatabaseEnv } from './config/env.js';
import { runIdentityCli, EXIT_USAGE, promptHidden, type CliIo } from './modules/identity/index.js';
import { createPool } from './infra/database/pool.js';

/**
 * Entrypoint of the account commands (`node dist/cli.js create-admin ...`). It reads only the
 * database variables, runs without the Nest container and exits with the code of the command.
 */

let databaseUrl: string;
try {
  databaseUrl = loadDatabaseEnv().databaseUrl;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(EXIT_USAGE);
}

const pool = createPool(databaseUrl);
const io: CliIo = {
  db: drizzle(pool),
  // Raw standard input, which carries the password only with `--password-stdin` (CLI-06).
  stdin,
  stdout,
  stderr: process.stderr,
  promptPassword: promptHidden,
};

try {
  process.exitCode = await runIdentityCli(process.argv.slice(2), io);
} catch {
  // A database error is reported as one line: the driver's own message repeats the query and, with
  // it, the password hash the command just computed, which is credential material (AUTH-18). The
  // details stay out of the log, and the operator sees that the command failed, not why verbatim.
  io.stderr.write('the command could not reach the database; nothing was changed\n');
  process.exitCode = 1;
} finally {
  await pool.end();
}
