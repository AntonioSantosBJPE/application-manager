import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, run } from './repo.js';

const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8').split('\n');

describe('.gitignore', () => {
  it('lists the Python bytecode of the skill scripts', () => {
    expect(gitignore).toContain('__pycache__/');
    expect(gitignore).toContain('*.py[cod]');
  });

  it('ignores the bytecode folders of both skill copies', () => {
    for (const root of ['.claude/skills', '.agents/skills']) {
      const result = run(
        'git',
        ['check-ignore', `${root}/tlc-spec-driven/scripts/__pycache__/x.cpython-312.pyc`],
        { cwd: repoRoot },
      );
      expect(result.status, `${root} bytecode must be ignored`).toBe(0);
    }
  });

  it('tracks no Python bytecode', () => {
    const tracked = run('git', ['ls-files'], { cwd: repoRoot })
      .output.split('\n')
      .filter((file) => /(^|\/)__pycache__\/|\.py[cod]$/.test(file));
    expect(tracked).toEqual([]);
  });
});
