import { join } from 'node:path';
import { cruise, format, type ICruiseResult } from 'dependency-cruiser';
import extractDepcruiseOptions from 'dependency-cruiser/config-utl/extract-depcruise-options';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './repo.js';

const fixtures = join(repoRoot, 'tooling/guardrails/fixtures/boundaries');

interface Boundaries {
  /** Every resolved import in the tree, as `from → to`. */
  edges: string[];
  violations: { rule: string; from: string; to: string }[];
  report: string;
}

/** Cruises a fixture tree (laid out like the repo root) with the real `.dependency-cruiser.cjs`. */
async function checkBoundaries(fixture: string): Promise<Boundaries> {
  const options = await extractDepcruiseOptions(join(repoRoot, '.dependency-cruiser.cjs'));
  const { output } = await cruise(['apps'], { ...options, baseDir: join(fixtures, fixture) });
  const result = output as ICruiseResult;
  const { output: report } = await format(result, { outputType: 'err' });
  return {
    edges: result.modules.flatMap((m) => m.dependencies.map((d) => `${m.source} → ${d.resolved}`)),
    violations: result.summary.violations.map((v) => ({
      rule: v.rule.name,
      from: v.from,
      to: v.to,
    })),
    report: report as string,
  };
}

describe('dependency boundaries', () => {
  it('fails an app importing another app naming file and import', async () => {
    const { violations, report } = await checkBoundaries('cross-app');

    expect(violations).toEqual([
      { rule: 'no-cross-app', from: 'apps/web/src/main.ts', to: 'apps/api/src/secret.ts' },
    ]);
    expect(report).toContain('no-cross-app: apps/web/src/main.ts → apps/api/src/secret.ts');
  });

  it('fails a feature importing another feature internals naming file and import', async () => {
    const { violations, report } = await checkBoundaries('feature-internals');

    expect(violations).toEqual([
      {
        rule: 'no-feature-internals',
        from: 'apps/web/src/features/billing/components/invoice.ts',
        to: 'apps/web/src/features/system-status/model/system-status.ts',
      },
    ]);
    expect(report).toContain(
      'no-feature-internals: apps/web/src/features/billing/components/invoice.ts → apps/web/src/features/system-status/model/system-status.ts',
    );
  });

  it('fails a module importing another module internals naming file and import', async () => {
    const { violations, report } = await checkBoundaries('module-internals');

    expect(violations).toEqual([
      {
        rule: 'no-module-internals',
        from: 'apps/api/src/modules/billing/billing.service.ts',
        to: 'apps/api/src/modules/health/database-probe.ts',
      },
    ]);
    expect(report).toContain(
      'no-module-internals: apps/api/src/modules/billing/billing.service.ts → apps/api/src/modules/health/database-probe.ts',
    );
  });

  it('allows a feature importing another feature through its index.ts', async () => {
    const { edges, violations } = await checkBoundaries('feature-public-api');

    expect(edges).toContain(
      'apps/web/src/features/billing/components/invoice.ts → apps/web/src/features/system-status/index.ts',
    );
    expect(violations).toEqual([]);
  });

  it('allows a module importing another module through its index.ts', async () => {
    const { edges, violations } = await checkBoundaries('module-public-api');

    expect(edges).toContain(
      'apps/api/src/modules/billing/billing.service.ts → apps/api/src/modules/health/index.ts',
    );
    expect(violations).toEqual([]);
  });

  it('blocks importing identity internals from another module', async () => {
    const { violations, report } = await checkBoundaries('identity-internals');

    // The guard and the session cookie are reachable only through identity's index.ts (EDGE-08, AUTH-19).
    expect(violations).toEqual([
      {
        rule: 'no-module-internals',
        from: 'apps/api/src/modules/reports/reports.service.ts',
        to: 'apps/api/src/modules/identity/http/session.guard.ts',
      },
    ]);
    expect(report).toContain(
      'no-module-internals: apps/api/src/modules/reports/reports.service.ts → apps/api/src/modules/identity/http/session.guard.ts',
    );
  });

  it('allows imports inside the same feature and the same module', async () => {
    const { edges, violations } = await checkBoundaries('own-internals');

    expect(edges).toEqual(
      expect.arrayContaining([
        'apps/web/src/features/system-status/components/status-panel.ts → apps/web/src/features/system-status/model/system-status.ts',
        'apps/api/src/modules/health/health.controller.ts → apps/api/src/modules/health/database-probe.ts',
      ]),
    );
    expect(violations).toEqual([]);
  });
});
