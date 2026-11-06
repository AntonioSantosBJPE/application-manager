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
  // A prompt reads the terminal even when standard input is a pipe carrying no password (CLI-06).
  stdin,
  stdout,
  stderr: process.stderr,
  promptPassword: promptHidden,
};

try {
  process.exitCode = await runIdentityCli(process.argv.slice(2), io);
} finally {
  await pool.end();
}
