import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { repoRoot } from './repo.js';

interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}
interface Job {
  if?: string;
  needs?: string | string[];
  permissions?: unknown;
  steps?: Step[];
  strategy?: { 'fail-fast'?: boolean; matrix?: { shard?: string[]; include?: { name: string; group: string; shard: string }[] } };
}
interface Workflow {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs?: Record<string, Job>;
}

const source = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const workflow = parse(source) as Workflow;
const jobs = workflow.jobs ?? {};

/** The composite actions of the repository, which the jobs call as `./.github/actions/<name>`. */
const actionNames = ['setup', 'warm-images'] as const;
const actionSources = Object.fromEntries(
  actionNames.map((name) => [name, readFileSync(join(repoRoot, `.github/actions/${name}/action.yml`), 'utf8')]),
) as Record<(typeof actionNames)[number], string>;
const actionSteps = (name: string): Step[] =>
  (parse(actionSources[name as (typeof actionNames)[number]]) as { runs?: { steps?: Step[] } }).runs?.steps ?? [];

/** The steps of a job with each local composite action expanded into its own steps. */
function expanded(jobName: string): Step[] {
  return (jobs[jobName]?.steps ?? []).flatMap((step) =>
    step.uses?.startsWith('./.github/actions/') ? actionSteps(step.uses.replace('./.github/actions/', '')) : [step],
  );
}
const steps = Object.keys(jobs).flatMap(expanded);

/** Every shell command of a job, its composite actions included, as one text. */
function commands(jobName: string): string {
  return expanded(jobName)
    .map((step) => step.run ?? '')
    .join('\n');
}

/** Whether a job calls a local composite action, with the given inputs. */
function calls(jobName: string, action: string, inputs?: Record<string, unknown>): boolean {
  return (jobs[jobName]?.steps ?? []).some(
    (step) => step.uses === `./.github/actions/${action}` && (inputs === undefined || JSON.stringify(step.with) === JSON.stringify(inputs)),
  );
}

describe('ci workflow', () => {
  it('runs on pull requests and as the gates of a deploy, never a second time on a push to main', () => {
    // Triggers (CI-01): the push to main runs the gates once, through deploy.yml.
    expect(Object.keys(workflow.on ?? {}).sort()).toEqual(['pull_request', 'workflow_call']);
    expect((workflow.on?.pull_request as { types?: string[] }).types).toContain('labeled');

    // One job per concern.
    expect(Object.keys(jobs).sort()).toEqual(['e2e', 'infra', 'integration', 'quality', 'repo-rules', 'scopes', 'secrets', 'workflow-lint']);

    // Lint, typecheck and unit tests, with the frozen lockfile.
    expect(commands('quality')).toMatch(/pnpm install --frozen-lockfile/);
    expect(commands('quality')).toMatch(/^pnpm lint$/m);
    expect(commands('quality')).toMatch(/^pnpm typecheck$/m);
    expect(commands('quality')).toMatch(/^pnpm test$/m);
    expect(commands('integration')).toMatch(/^pnpm test:integration -- "--shard=\$SHARD"$/m);
    expect(commands('repo-rules')).toMatch(/^pnpm test:repo-rules$/m);
    expect(commands('infra')).toMatch(/^pnpm --filter @am\/guardrails test:infra$/m);
    expect(commands('e2e')).toMatch(/^pnpm test:e2e /m);

    // Gitleaks over the whole history: full clone, `gitleaks git`, no `dir` scan of the working tree.
    const secretsSteps = jobs.secrets?.steps ?? [];
    const checkout = secretsSteps.find((step) => step.uses?.startsWith('actions/checkout@'));
    expect(checkout?.with?.['fetch-depth']).toBe(0);
    expect(commands('secrets')).toMatch(/"\$GITLEAKS_IMAGE" git /);
    expect(JSON.stringify(jobs.secrets)).toMatch(/ghcr\.io\/gitleaks\/gitleaks:v[\d.]+@sha256:[0-9a-f]{64}/);
  });

  it('always runs the fast gates, and the slow suites when the scopes ask for them', () => {
    for (const job of ['quality', 'integration', 'secrets', 'workflow-lint']) expect(jobs[job]?.if, job).toBeUndefined();
    const gated = { 'repo-rules': 'repo_rules', e2e: 'e2e', infra: 'infra' } as const;
    for (const [job, output] of Object.entries(gated)) {
      expect([jobs[job]?.needs].flat(), job).toEqual(['scopes']);
      expect(jobs[job]?.if, job).toBe(`\${{ needs.scopes.outputs.${output} == 'true' }}`);
    }
    // Outside a pull request (the deploy), with CI_FULL, or with the ci:full label, every suite runs; a
    // pull request otherwise asks scripts/ci-scopes.sh about the paths it changes.
    const decide = jobs.scopes?.steps?.find((step) => step.run?.includes('ci-scopes.sh'));
    expect(decide?.run).toContain('"$EVENT" != "pull_request"');
    expect(decide?.run).toContain('git diff --name-only "$BASE_SHA...$HEAD_SHA" | scripts/ci-scopes.sh');
    expect(JSON.stringify(decide)).toContain("vars.CI_FULL == 'true'");
    expect(JSON.stringify(decide)).toContain("contains(github.event.pull_request.labels.*.name, 'ci:full')");
  });

  it('splits the end-to-end specs into a platform job and browser shards that cover every shard', () => {
    const include = jobs.e2e?.strategy?.matrix?.include ?? [];
    expect(jobs.e2e?.strategy?.['fail-fast']).toBe(false);
    expect(include.filter((entry) => entry.group === 'platform')).toHaveLength(1);
    const shards = include.filter((entry) => entry.group === 'browser').map((entry) => entry.shard);
    expect(shards.length).toBeGreaterThan(0);
    // Every browser shard names the same total, and the totals cover 1..n once: no spec is left out.
    expect(shards.sort()).toEqual(Array.from({ length: shards.length }, (_, index) => `${index + 1}/${shards.length}`).sort());
    const run = expanded('e2e').find((step) => step.run?.startsWith('pnpm test:e2e'));
    expect(run?.env).toEqual({ E2E_GROUP: '${{ matrix.group }}', E2E_SHARD: '${{ matrix.shard }}' });
    expect(run?.run).toBe('pnpm test:e2e ${E2E_SHARD:+"--shard=$E2E_SHARD"}');
  });

  it('splits the integration tests into shards that cover every shard', () => {
    const shards = jobs.integration?.strategy?.matrix?.shard ?? [];
    expect(jobs.integration?.strategy?.['fail-fast']).toBe(false);
    expect(shards.length).toBeGreaterThan(0);
    expect(shards).toEqual(Array.from({ length: shards.length }, (_, index) => `${index + 1}/${shards.length}`));
    expect(JSON.stringify(jobs.integration?.steps)).toContain('"SHARD":"${{ matrix.shard }}"');
  });

  it('installs from the lockfile everywhere, Chromium where a browser runs, and warms the images where they are built', () => {
    for (const job of ['quality', 'repo-rules', 'integration', 'infra', 'e2e']) expect(calls(job, 'setup'), job).toBe(true);
    expect(actionSources.setup).toMatch(/^\s*run: pnpm install --frozen-lockfile$/m);
    expect(calls('quality', 'setup', { chromium: 'true' })).toBe(true);
    expect(calls('repo-rules', 'setup', { chromium: 'true' })).toBe(true);
    expect(calls('e2e', 'setup', { chromium: 'true' })).toBe(true);
    for (const job of ['infra', 'e2e']) expect(calls(job, 'warm-images'), job).toBe(true);
    // The warm-up reads the cache scopes the deploy writes, and never writes them from a pull request.
    for (const scope of ['api', 'web']) expect(actionSources['warm-images']).toContain(`cache-from: type=gha,scope=${scope}`);
    expect(actionSources['warm-images']).not.toMatch(/cache-to/);
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
      const line = [source, ...Object.values(actionSources)].join('\n').split('\n').find((candidate) => candidate.includes(reference));
      expect(line, reference).toMatch(/# v\d+(\.\d+)*\s*$/);
    }
  });

  it('never uses pull_request_target', () => {
    expect(workflow.on).not.toHaveProperty('pull_request_target');
    expect(source).not.toMatch(/pull_request_target/);
  });
});
