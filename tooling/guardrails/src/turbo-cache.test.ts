import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './repo.js';

interface Task {
  dependsOn?: string[];
  cache?: boolean;
  inputs?: string[];
}
interface Turbo {
  tasks?: Record<string, Task>;
}

const turbo = JSON.parse(readFileSync(join(repoRoot, 'turbo.json'), 'utf8')) as Turbo;
const tasks = turbo.tasks ?? {};

describe('turbo cache', () => {
  it('reruns the guardrails tests whenever the repository changes', () => {
    // The tests of @am/guardrails scan apps/, packages/ and the root files, but turbo hashes only the
    // package's own files by default: a violation elsewhere would pass as `cache hit, replaying logs`.
    const task = tasks['@am/guardrails#test'];
    expect(task, '@am/guardrails#test must be declared in turbo.json').toBeDefined();

    const noCache = task?.cache === false;
    // `inputs` that reach out of the package to the repository root cover the whole repository.
    const coversRepository = (task?.inputs ?? []).some((input) =>
      input.startsWith('$TURBO_ROOT$/'),
    );
    expect(
      noCache || coversRepository,
      '@am/guardrails#test must set "cache": false or declare "inputs" under $TURBO_ROOT$',
    ).toBe(true);

    // A package task replaces the generic `test` task, so it must repeat the build dependency.
    expect(task?.dependsOn).toEqual(tasks.test?.dependsOn);
  });

  it('keeps the cache of every other task', () => {
    // Only the integration tests (they need a live database) run uncached.
    const uncached = Object.entries(tasks)
      .filter(([, task]) => task.cache === false)
      .map(([name]) => name)
      .sort();
    expect(uncached).toEqual(['@am/guardrails#test', 'test:integration']);
  });
});
