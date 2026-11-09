import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { repoRoot } from '../repo.js';

interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  if?: string;
}
interface Job {
  needs?: string | string[];
  if?: string;
  uses?: string;
  permissions?: Record<string, string>;
  env?: Record<string, string>;
  steps?: Step[];
  strategy?: { matrix?: { include?: { name: string; build_args?: string }[] } };
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
const ciJobs = ci.jobs ?? {};
const ciCommands = (name: string) => (ciJobs[name]?.steps ?? []).map((step) => step.run ?? '').join('\n');

interface Context {
  preflight: string;
  publish: string;
  event: string;
  tag: string;
}

/** Evaluates a job `if:` (the `${{ }}` subset the workflow uses) for one situation. */
function evaluate(expression: string, context: Context): boolean {
  const js = expression
    .replace(/^\$\{\{\s*|\s*\}\}$/g, '')
    .replace(/!cancelled\(\)/g, 'true')
    .replace(/needs\.preflight\.result/g, JSON.stringify(context.preflight))
    .replace(/needs\.publish\.result/g, JSON.stringify(context.publish))
    .replace(/github\.event_name/g, JSON.stringify(context.event))
    .replace(/inputs\.tag/g, JSON.stringify(context.tag));
  return new Function(`return (${js});`)() as boolean;
}

/** Runs the `preflight` script under bash with the given environment and returns its result. */
function runPreflight(env: Record<string, string>) {
  const script = jobs.preflight?.steps?.find((step) => step.run)?.run ?? '';
  const result = spawnSync('bash', ['-c', script], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const goodEnv = {
  COOLIFY_URL: 'https://coolify.example.invalid',
  COOLIFY_TOKEN: 'token-value-aaa111',
  COOLIFY_RESOURCE_UUID: 'uuid-value-bbb222',
  WEB_PUBLIC_URL: 'https://app.example.invalid',
  DEPLOY_REF: 'refs/heads/main',
  DEPLOY_TAG: '',
};

describe('deploy workflow', () => {
  it('DEPLOY-01 runs the CI gates (lint, typecheck, tests, integration tests, secret scan) before any image is built', () => {
    expect(jobs.gates?.uses).toBe('./.github/workflows/ci.yml');
    expect(jobs.gates?.if).toBe("${{ inputs.tag == '' }}");
    expect(ancestors('build').has('gates')).toBe(true);
    expect(Object.keys(ci.on ?? {})).toContain('workflow_call');
    // Each gate is a command of a job that no `if:` can switch off on a push to main.
    expect(ciCommands('quality')).toMatch(/^pnpm lint$/m);
    expect(ciCommands('quality')).toMatch(/^pnpm typecheck$/m);
    expect(ciCommands('quality')).toMatch(/^pnpm test$/m);
    expect(ciCommands('integration')).toMatch(/^pnpm test:integration$/m);
    expect(ciCommands('secrets')).toMatch(/"\$GITLEAKS_IMAGE" git /);
    for (const job of ['quality', 'integration', 'secrets']) expect(ciJobs[job]?.if, `ci job ${job}`).toBeUndefined();
  });

  it('DEPLOY-02 calls Coolify only after a successful publish, or on a manual rollback, and never after a red gate or preflight', () => {
    for (const job of ['build', 'publish', 'release']) expect(ancestors(job).has('gates')).toBe(true);
    const expression = jobs.release?.if ?? '';
    const run = (overrides: Partial<Context>) => evaluate(expression, { preflight: 'success', publish: 'success', event: 'push', tag: '', ...overrides });
    expect(run({})).toBe(true); // push, everything green
    expect(run({ publish: 'skipped' })).toBe(false); // push, a gate failed: build and publish were skipped
    expect(run({ publish: 'failure' })).toBe(false); // push, an image failed to publish
    expect(run({ publish: 'cancelled' })).toBe(false);
    expect(run({ event: 'workflow_dispatch', publish: 'skipped' })).toBe(false); // manual run without tag, gates failed
    expect(run({ event: 'workflow_dispatch', publish: 'success' })).toBe(true); // manual full pipeline, green
    expect(run({ event: 'workflow_dispatch', publish: 'skipped', tag: 'a'.repeat(40) })).toBe(true); // rollback
    expect(run({ preflight: 'failure' })).toBe(false);
    expect(run({ preflight: 'failure', event: 'workflow_dispatch', publish: 'skipped', tag: 'a'.repeat(40) })).toBe(false);
  });

  it('DEPLOY-03 publishes api, web and backup to GHCR tagged with the full commit SHA, the web carrying its version', () => {
    const names = jobs.publish?.strategy?.matrix?.include?.map((entry) => entry.name).sort();
    expect(names).toEqual(['api', 'backup', 'web']);
    const push = (jobs.publish?.steps ?? []).find((step) => step.uses?.startsWith('docker/build-push-action@'));
    expect(push?.with?.push).toBe(true);
    expect(String(push?.with?.tags)).toContain('${{ github.sha }}');
    expect(source).toContain('ghcr.io/${GITHUB_REPOSITORY,,}-${IMAGE_NAME}');
    const builds = jobs.build?.strategy?.matrix?.include?.map((entry) => entry.name).sort();
    expect(builds).toEqual(['api', 'backup', 'web']);
    for (const job of ['build', 'publish']) {
      const web = jobs[job]?.strategy?.matrix?.include?.find((entry) => entry.name === 'web');
      expect(web?.build_args, job).toBe('APP_VERSION=${{ github.sha }}');
    }
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
    // No input or context value is interpolated into a script: they all go through env.
    for (const step of allSteps) expect(step.run ?? '').not.toContain('${{');
  });

  it('DEPLOY-05 triggers only on push to main and manual runs, never on pull requests or forks', () => {
    expect(Object.keys(workflow.on ?? {}).sort()).toEqual(['push', 'workflow_dispatch']);
    expect((workflow.on?.push as { branches?: string[] }).branches).toEqual(['main']);
    expect(source).not.toMatch(/pull_request/);
  });

  it('DEPLOY-06 hands Coolify the URL, the token and the UUID from the repository secrets', () => {
    const step = jobs.release?.steps?.find((entry) => entry.run?.includes('coolify.sh'));
    expect(step?.env).toMatchObject({
      COOLIFY_URL: '${{ secrets.COOLIFY_URL }}',
      COOLIFY_TOKEN: '${{ secrets.COOLIFY_TOKEN }}',
      COOLIFY_RESOURCE_UUID: '${{ secrets.COOLIFY_RESOURCE_UUID }}',
    });
    expect(step?.run).toContain('"$TAG"');
  });

  describe('DEPLOY-07 preflight', () => {
    it('DEPLOY-07 runs before the gates, so a missing secret stops the run before anything is published', () => {
      expect(needs('gates')).toContain('preflight');
      for (const job of ['build', 'publish']) expect(ancestors(job).has('preflight')).toBe(true);
    });

    it('DEPLOY-07 passes when main, no tag and every secret are present', () => {
      expect(runPreflight(goodEnv).status).toBe(0);
    });

    it.each(['COOLIFY_URL', 'COOLIFY_TOKEN', 'COOLIFY_RESOURCE_UUID', 'WEB_PUBLIC_URL'])(
      'DEPLOY-07 fails naming %s when it is missing, and prints the value of none of the others',
      (missing) => {
        const result = runPreflight({ ...goodEnv, [missing]: '' });
        expect(result.status).toBe(1);
        expect(result.output).toContain(missing);
        for (const [name, value] of Object.entries(goodEnv)) {
          if (name !== missing && value !== '') expect(result.output, name).not.toContain(value);
        }
      },
    );

    it('DEPLOY-07 refuses a run on a branch other than main, so a manual run cannot ship an unreviewed branch', () => {
      const result = runPreflight({ ...goodEnv, DEPLOY_REF: 'refs/heads/feature-x' });
      expect(result.status).toBe(1);
      expect(result.output).toContain('only from main');
    });

    it.each(['abc123', '$(touch /tmp/injected)', `${'a'.repeat(39)}"`, `${'a'.repeat(40)}x`])(
      'DEPLOY-07 refuses the tag %s: only a full commit SHA is a rollback target',
      (tag) => {
        const result = runPreflight({ ...goodEnv, DEPLOY_TAG: tag });
        expect(result.status).toBe(1);
        expect(result.output).toContain('40-character commit SHA');
      },
    );

    it('DEPLOY-07 accepts a full commit SHA as the tag', () => {
      expect(runPreflight({ ...goodEnv, DEPLOY_TAG: 'a'.repeat(40) }).status).toBe(0);
    });
  });

  it('DEPLOY-08 waits for the version just deployed, not only for a healthy page', () => {
    const step = jobs.release?.steps?.find((entry) => entry.run?.includes('smoke.sh'));
    expect(step?.env?.SMOKE_EXPECTED_VERSION).toBe('${{ inputs.tag || github.sha }}');
    expect(step?.env?.WEB_PUBLIC_URL).toBe('${{ vars.WEB_PUBLIC_URL }}');
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
    const release = jobs.release?.steps ?? [];
    const check = release.find((step) => step.run?.includes('check-tag.sh'));
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

  it('DEPLOY-45 checks the tag in GHCR before it touches Coolify', () => {
    const steps = jobs.release?.steps ?? [];
    const check = steps.findIndex((step) => step.run?.includes('check-tag.sh'));
    const coolify = steps.findIndex((step) => step.run?.includes('coolify.sh'));
    const smoke = steps.findIndex((step) => step.run?.includes('smoke.sh'));
    expect(check).toBeGreaterThan(-1);
    expect(coolify).toBeGreaterThan(check);
    expect(smoke).toBeGreaterThan(coolify);
  });
});
