import { run, runOk, repoRoot, type CommandResult } from './docker.js';

/** The compose project of this checkout, as named by COMPOSE_PROJECT_NAME in its .env (SKEL-13). */
export const projectName = process.env.COMPOSE_PROJECT_NAME ?? 'application-manager';

/** Runs `docker compose <args>` for this checkout and returns the result without throwing on a non-zero exit. */
export function compose(args: string[], env: NodeJS.ProcessEnv = process.env): CommandResult {
  return run('docker', ['compose', ...args], { env });
}

/** Runs `docker compose <args>` and throws, with the output, when it exits non-zero. */
export function composeOk(args: string[]): string {
  const result = compose(args);
  if (result.status !== 0) throw new Error(`docker compose ${args.join(' ')} exited ${result.status}\n${result.output}`);
  return result.output;
}

export interface ContainerState {
  Status: string;
  Running: boolean;
  ExitCode: number;
  StartedAt: string;
  FinishedAt: string;
}

export interface ContainerInfo {
  Id: string;
  Config: { Labels: Record<string, string> };
  State: ContainerState;
}

/** `docker inspect` of the container of `service` (the last one when the service has several). */
export function inspectService(service: string, project = projectName): ContainerInfo {
  const ids = runOk('docker', [
    'ps', '--all', '--quiet',
    '--filter', `label=com.docker.compose.project=${project}`,
    '--filter', `label=com.docker.compose.service=${service}`,
  ]).trim().split('\n').filter(Boolean);
  if (ids.length === 0) throw new Error(`no container for service ${service} in project ${project}`);
  const [info] = JSON.parse(runOk('docker', ['inspect', ids[0]!])) as ContainerInfo[];
  return info!;
}

/** Runs a SQL statement in the postgres service and returns its unaligned output. */
export function psql(sql: string): string {
  const user = process.env.POSTGRES_USER ?? '';
  const db = process.env.POSTGRES_DB ?? '';
  return composeOk(['exec', '-T', 'postgres', 'psql', '-U', user, '-d', db, '-tAc', sql]).trim();
}

/** Polls until the service reports healthy (compose `--wait` already covers a fresh `up`). */
export async function waitHealthy(service: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const health = runOk('docker', ['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', inspectService(service).Id]).trim();
    if (health === 'healthy' || (health === 'running' && service === 'migrate')) return;
    if (Date.now() > deadline) throw new Error(`${service} is ${health}, not healthy after ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export { repoRoot };
