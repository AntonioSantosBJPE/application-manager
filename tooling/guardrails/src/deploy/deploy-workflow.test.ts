import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { repoRoot } from '../repo.js';

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  if?: string;
}
interface Job {
  needs?: string | string[];
  if?: string;
  uses?: string;
  permissions?: Record<string, string>;
  steps?: Step[];
  strategy?: { matrix?: { include?: { name: string }[] } };
}
interface Workflow {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs?: Record<string, Job>;
}

const source = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');
const workflow = parse(source) as Workflow;
const jobs = workflow.jobs ?? {};
const needs = (name: string): string[] => [jobs[name]?.needs ?? []].flat();

/** Every job that must have finished before `name` starts, transitively. */
function ancestors(name: string, seen = new Set<string>()): Set<string> {
  for (const parent of needs(name)) {
    if (!seen.has(parent)) {
      seen.add(parent);
      ancestors(parent, seen);
    }
  }
  return seen;
}

const commands = (name: string) => (jobs[name]?.steps ?? []).map((step) => step.run ?? '').join('\n');
const allSteps = Object.values(jobs).flatMap((job) => job.steps ?? []);
const ciSource = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const ci = parse(ciSource) as Workflow;

describe('deploy workflow', () => {
  it('DEPLOY-01 runs the CI gates (lint, typecheck, tests, secret scan) before any image is built', () => {
    expect(jobs.gates?.uses).toBe('./.github/workflows/ci.yml');
    expect(ancestors('build').has('gates')).toBe(true);
    // The called workflow holds the checks the criterion names.
    const ciCommands = Object.values(ci.jobs ?? {})
      .flatMap((job) => job.steps ?? [])
      .map((step) => step.run ?? '')
      .join('\n');
    expect(Object.keys(ci.on ?? {})).toContain('workflow_call');
    for (const command of ['pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm test:integration', 'gitleaks']) {
      expect(ciCommands + JSON.stringify(ci.jobs)).toContain(command);
    }
  });

  it('DEPLOY-02 publishes nothing and does not call Coolify unless the gates and the builds passed', () => {
    for (const job of ['build', 'publish', 'release']) {
      expect(ancestors(job).has('gates')).toBe(true);
    }
    // `release` only runs after a successful `publish`, or on a manual rollback.
    expect(jobs.release?.if).toContain("needs.publish.result == 'success'");
    expect(jobs.release?.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(jobs.release?.if).toContain("inputs.tag != ''");
    expect(jobs.release?.if).not.toMatch(/always\(\)/);
  });

  it('DEPLOY-03 publishes api, web and backup to GHCR tagged with the full commit SHA', () => {
    const names = jobs.publish?.strategy?.matrix?.include?.map((entry) => entry.name).sort();
    expect(names).toEqual(['api', 'backup', 'web']);
    const push = (jobs.publish?.steps ?? []).find((step) => step.uses?.startsWith('docker/build-push-action@'));
    expect(push?.with?.push).toBe(true);
    expect(String(push?.with?.tags)).toContain('${{ github.sha }}');
    expect(source).toContain('ghcr.io/${GITHUB_REPOSITORY,,}-${{ matrix.name }}');
    const builds = jobs.build?.strategy?.matrix?.include?.map((entry) => entry.name).sort();
    expect(builds).toEqual(['api', 'backup', 'web']);
  });

  it('DEPLOY-04 declares minimal permissions, packages write only in publish, and pins every action by SHA', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    const writers = Object.entries(jobs)
      .filter(([, job]) => job.permissions?.packages === 'write')
      .map(([name]) => name);
    expect(writers).toEqual(['publish']);
    for (const [name, job] of Object.entries(jobs)) {
      if (name !== 'publish') expect(job.permissions).toBeUndefined();
    }
    for (const step of allSteps) {
      if (step.uses) expect(step.uses).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  it('DEPLOY-05 triggers only on push to main and manual runs, never on pull requests or forks', () => {
    expect(Object.keys(workflow.on ?? {}).sort()).toEqual(['push', 'workflow_dispatch']);
    expect((workflow.on?.push as { branches?: string[] }).branches).toEqual(['main']);
    expect(source).not.toMatch(/pull_request/);
  });

  it('DEPLOY-07 stops before anything is published when a secret or variable is missing', () => {
    expect(needs('gates')).toContain('preflight');
    expect(ancestors('build').has('preflight')).toBe(true);
    const preflight = commands('preflight');
    for (const name of ['COOLIFY_URL', 'COOLIFY_TOKEN', 'COOLIFY_RESOURCE_UUID', 'WEB_PUBLIC_URL']) {
      expect(preflight).toContain(name);
    }
    // Only the name is printed, never the value.
    expect(preflight).toContain('is not set');
    expect(preflight).not.toMatch(/echo[^\n]*\$\{!?name\}[^\n]*\$\{!name\}/);
  });

  it('DEPLOY-10 serializes deploys in one group without cancelling the one in progress', () => {
    expect(workflow.concurrency?.group).toBe('deploy');
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(false);
  });

  it('DEPLOY-22 a manual run with a tag skips gates, build and publish and redeploys that tag', () => {
    const dispatch = (workflow.on?.workflow_dispatch as { inputs?: { tag?: { required?: boolean } } }).inputs;
    expect(dispatch?.tag?.required).toBe(false);
    expect(jobs.gates?.if).toContain("inputs.tag == ''");
    // build and publish need gates, so they are skipped together with it.
    expect(needs('build')).toEqual(['gates']);
    expect(needs('publish')).toEqual(['build']);
    const release = jobs.release;
    const check = (release?.steps ?? []).find((step) => step.run?.includes('check-tag.sh'));
    expect(check?.if).toContain("inputs.tag != ''");
    expect(commands('release')).toContain('infra/deploy/coolify.sh "$TAG"');
    expect(commands('release')).toContain('infra/deploy/smoke.sh');
    expect(source).toContain('TAG: ${{ inputs.tag || github.sha }}');
  });

  it('DEPLOY-42 builds every image without pushing, and publishes only after all builds passed', () => {
    const build = (jobs.build?.steps ?? []).find((step) => step.uses?.startsWith('docker/build-push-action@'));
    expect(build?.with?.push).toBe(false);
    expect(jobs.build?.strategy).toMatchObject({ 'fail-fast': true });
    // A matrix job is green only when every entry is, so `publish` waits for all three builds.
    expect(needs('publish')).toEqual(['build']);
  });
});
