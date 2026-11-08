import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repoRoot, run } from './repo.js';

const files = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  cwd: repoRoot,
})
  .output.split('\0')
  .filter(
    (file) =>
      (file.startsWith('apps/web/') || file.startsWith('packages/ui/')) &&
      /\.(ts|tsx|css|html|svg|mdx|json|webmanifest)$/.test(file) &&
      existsSync(join(repoRoot, file)),
  );

describe('product name', () => {
  it('PRU-06 AC23 never writes "Application Manager" in the web or in the design system', () => {
    const found = files.flatMap((file) =>
      readFileSync(join(repoRoot, file), 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          /application manager/i.test(line) ? [`${file}:${index + 1}  ${line.trim()}`] : [],
        ),
    );

    expect(found).toEqual([]);
  });
});
