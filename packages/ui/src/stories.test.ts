import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const srcDir = path.dirname(fileURLToPath(import.meta.url));

/** Every component and archetype lives in a directory of its own, so the directory is the unit. */
const groups = ['components', 'layouts'] as const;

/** The directories under `root` without a `*.stories.tsx`, relative to it (UI-21, C93). */
function directoriesWithoutStory(root: string): string[] {
  return groups
    .flatMap((group) =>
      readdirSync(path.join(root, group), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${group}/${entry.name}`),
    )
    .filter(
      (directory) =>
        !readdirSync(path.join(root, directory)).some((file) => file.endsWith('.stories.tsx')),
    );
}

const created: string[] = [];

/** A throwaway package root holding the given `directory -> files` tree. */
function fixtureRoot(tree: Record<string, string[]>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'ui-stories-'));
  created.push(root);
  for (const group of groups) mkdirSync(path.join(root, group));
  for (const [directory, files] of Object.entries(tree)) {
    mkdirSync(path.join(root, directory), { recursive: true });
    for (const file of files) writeFileSync(path.join(root, directory, file), '');
  }
  return root;
}

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('stories coverage', () => {
  it('every component and archetype has a story', () => {
    const directories = [...directoriesWithoutStory(srcDir)];

    expect(directories).toEqual([]);
  });

  it('fails naming a component directory that has no story', () => {
    const root = fixtureRoot({
      'components/with-story': ['with-story.tsx', 'WithStory.stories.tsx'],
      'components/without-story': ['without-story.tsx', 'without-story.test.tsx'],
      'layouts/without-story': ['without-story.tsx'],
    });

    expect(directoriesWithoutStory(root)).toEqual([
      'components/without-story',
      'layouts/without-story',
    ]);
  });
});
