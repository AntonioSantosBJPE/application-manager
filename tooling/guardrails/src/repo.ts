import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { resolve } from 'node:path';

/** Absolute path of the repository root (this file lives in tooling/guardrails/src). */
export const repoRoot = resolve(import.meta.dirname, '../../..');

export interface RunResult {
  status: number | null;
  output: string;
}

/** Runs a command and returns its exit status with stdout and stderr together. */
export function run(command: string, args: string[], options: SpawnSyncOptions = {}): RunResult {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}
