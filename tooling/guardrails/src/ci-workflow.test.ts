import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { repoRoot } from './repo.js';

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}
interface Job {
  permissions?: unknown;
  steps?: Step[];
}
interface Workflow {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs?: Record<string, Job>;
}

const source = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const workflow = parse(source) as Workflow;
const jobs = workflow.jobs ?? {};
const steps = Object.values(jobs).flatMap((job) => job.steps ?? []);

/** Every shell command of a job, as one text. */
function commands(jobName: string): string {
  return (jobs[jobName]?.steps ?? []).map((step) => step.run ?? '').join('\n');
}

describe('ci workflow', () => {
  it('runs every required step on pull_request and push to main', () => {
    // Triggers (CI-01).
    expect(Object.keys(workflow.on ?? {}).sort()).toEqual(['pull_request', 'push']);
    expect((workflow.on?.push as { branches?: string[] }).branches).toEqual(['main']);

    // One job per concern.
    expect(Object.keys(jobs).sort()).toEqual(['e2e', 'images', 'integration', 'quality', 'secrets', 'workflow-lint']);

    // Lint, typecheck and unit tests, with the frozen lockfile.
    expect(commands('quality')).toMatch(/pnpm install --frozen-lockfile/);
    expect(commands('quality')).toMatch(/^pnpm lint$/m);
    expect(commands('quality')).toMatch(/^pnpm typecheck$/m);
    expect(commands('quality')).toMatch(/^pnpm test$/m);
    // Integration and end-to-end tests.
    expect(commands('integration')).toMatch(/^pnpm test:integration$/m);
    expect(commands('e2e')).toMatch(/^pnpm test:e2e$/m);

    // Gitleaks over the whole history: full clone, `gitleaks git`, no `dir` scan of the working tree.
    const secretsSteps = jobs.secrets?.steps ?? [];
    const checkout = secretsSteps.find((step) => step.uses?.startsWith('actions/checkout@'));
    expect(checkout?.with?.['fetch-depth']).toBe(0);
    expect(commands('secrets')).toMatch(/"\$GITLEAKS_IMAGE" git /);
    expect(JSON.stringify(jobs.secrets)).toMatch(/ghcr\.io\/gitleaks\/gitleaks:v[\d.]+@sha256:[0-9a-f]{64}/);

    // Both images are built.
    expect(commands('images')).toMatch(/docker build .*apps\/api\/Dockerfile/);
    expect(commands('images')).toMatch(/docker build .*apps\/web\/Dockerfile/);
  });

  it('declares contents read permissions at the top level', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    // No job widens the token.
    for (const [name, job] of Object.entries(jobs)) {
      expect(job.permissions, `job ${name} must not override the top-level permissions`).toBeUndefined();
    }
  });

  it('pins every third-party action to a full commit sha', () => {
    const uses = steps.map((step) => step.uses).filter((value): value is string => value !== undefined);
    expect(uses.length).toBeGreaterThan(0);
    for (const reference of uses) {
      if (reference.startsWith('./')) continue;
      expect(reference, 'third-party action must be pinned to a 40-character sha').toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
      // The version stays readable next to the sha.
      const line = source.split('\n').find((candidate) => candidate.includes(reference));
      expect(line, reference).toMatch(/# v\d+(\.\d+)*\s*$/);
    }
  });

  it('never uses pull_request_target', () => {
    expect(workflow.on).not.toHaveProperty('pull_request_target');
    expect(source).not.toMatch(/pull_request_target/);
  });
});
