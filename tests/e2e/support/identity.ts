import { randomUUID } from 'node:crypto';
import { compose, psql } from './compose.js';
import type { CommandResult } from './docker.js';

/**
 * Fictitious accounts for the identity specs. Nothing here is a real person or a real address: the
 * repository is public, so every seed uses `@example.com` (AGENTS.md).
 */
export const EMAIL_DOMAIN = 'example.com';

export function fixtureEmail(label: string): string {
  return `${label}-${randomUUID().slice(0, 8)}@${EMAIL_DOMAIN}`;
}

/**
 * A password that satisfies the 12 to 128 rule and is unique to the run, so a search through the
 * stack logs can tell whether the password of a test was written there (AUTH-18).
 */
export function fixturePassword(label: string): string {
  return `e2e-${label}-${randomUUID()}`;
}

export interface CliResult extends CommandResult {
  exitCode: number;
}

/** Runs one identity command in a throwaway container of the api image, the way an operator runs it. */
function runCli(args: string[], password: string): CliResult {
  // `--no-deps` keeps the command away from the running stack; `-T` is what lets stdin carry the password.
  const result = compose(
    ['run', '--rm', '--no-deps', '-T', 'api', 'node', 'dist/cli.js', ...args],
    process.env,
    `${password}\n`,
  );
  return { ...result, exitCode: result.status ?? -1 };
}

/** `create-admin` from the image of the api: the only way an admin is born (CLI-01, CLI-02). */
function createAdmin(email: string, name: string, password: string): CliResult {
  return runCli(['create-admin', '--email', email, '--name', name, '--password-stdin'], password);
}

/** Creates the admin and fails the spec when the command refuses, so later steps start from a real account. */
export function createAdminOk(email: string, name: string, password: string): void {
  const result = createAdmin(email, name, password);
  if (result.exitCode !== 0) throw new Error(`create-admin ${email} exited ${result.exitCode}\n${result.output}`);
}

const quoted = (value: string) => `'${value.replace(/'/g, "''")}'`;

function userId(email: string): string {
  const id = psql(`select id from identity.users where email = ${quoted(email)}`);
  if (id === '') throw new Error(`no user with ${email}`);
  return id;
}

/** The sessions of the account that are still in use; the expiry and revocation below touch these rows. */
function liveSessions(email: string): string {
  return `user_id = ${quoted(userId(email))} and revoked_at is null`;
}

/**
 * Moves the sessions of the account into the past. The production image takes no test clock, so an
 * expiry is arranged in the database instead (see the design, `Expiração em E2E`).
 */
export function expireSessions(email: string): void {
  psql(`update identity.sessions set expires_at = now() - interval '1 second' where ${liveSessions(email)}`);
}

/** Leaves a session with fewer than 29 days in it, so the next authenticated request renews it (AUTH-11). */
export function shortenSession(email: string, daysLeft: number): void {
  psql(`update identity.sessions set expires_at = now() + interval '${daysLeft} days' where ${liveSessions(email)}`);
}

/** Revokes every session of the account, as the CLI reset or a second invitation accept would (CLI-03, INV-10). */
export function revokeSessions(email: string): void {
  psql(`update identity.sessions set revoked_at = now() where ${liveSessions(email)}`);
}

/** Expires the pending invitation of an email without spending it, which no endpoint can do (INV-06). */
export function expireInvitations(email: string): void {
  psql(
    `update identity.invitations set expires_at = now() - interval '1 second'
     where email = ${quoted(email)} and accepted_at is null and revoked_at is null`,
  );
}

/** Every failure the lockout counts for an address, so a spec can start from a clean window (LOCK-01, LOCK-02). */
export function clearLoginAttempts(ip: string): void {
  psql(`delete from identity.login_attempts where ip = ${quoted(ip)}`);
}

/** Revokes every pending invitation, so a spec can start the pending total from a number it chose (ADM-01). */
export function revokePendingInvitations(): void {
  psql('update identity.invitations set revoked_at = now() where accepted_at is null and revoked_at is null');
}
