import { execFileSync, spawnSync, type ExecFileSyncOptions } from 'node:child_process';
import { resolve } from 'node:path';

/** Absolute path of the repository root (this file lives in tests/e2e/support). */
export const repoRoot = resolve(import.meta.dirname, '../../..');

export interface CommandResult {
  status: number | null;
  output: string;
}

/** Runs a command and returns its exit status with stdout and stderr together; never throws on a non-zero exit. */
export function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string } = {}): CommandResult {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** Runs a command that must succeed and returns its stdout. */
export function runOk(command: string, args: string[], options: ExecFileSyncOptions = {}): string {
  return execFileSync(command, args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options }).toString();
}

/** Builds an app image from the repository root, the same way the compose file does. */
export function buildImage(app: 'api' | 'web', tag: string): void {
  runOk('docker', ['build', '--file', `apps/${app}/Dockerfile`, '--tag', tag, '.'], { stdio: 'pipe' });
}

/** Runs a shell snippet inside a throwaway container of `image`, bypassing the image entrypoint. */
export function sh(image: string, script: string): CommandResult {
  return run('docker', ['run', '--rm', '--entrypoint', 'sh', image, '-c', script]);
}
