import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULES = resolve(import.meta.dirname, '../..');
const APPLICATIONS = join(MODULES, 'applications');
const SKILLS = join(MODULES, 'skills');

/** Every `.ts` file under `directory` that is not a test. */
function sourcesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourcesUnder(path);
    return entry.name.endsWith('.ts') && !/\.test\.ts$/.test(entry.name) ? [path] : [];
  });
}

/** The module specifiers a source imports, exports from or loads dynamically. */
function specifiersOf(source: string): string[] {
  const found = [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)];
  return found.map((match) => match[1]!);
}

/** The imports of `source`, written in `file`, that reach into the skills module by a path other than its `index`. */
export function skillsInteriorImports(file: string, source: string): string[] {
  return specifiersOf(source).filter((specifier) => {
    if (!specifier.startsWith('.')) return false;
    const target = resolve(dirname(file), specifier).replace(/\.(js|ts)$/, '');
    const inSkills = target === SKILLS || target.startsWith(`${SKILLS}/`);
    return inSkills && target !== join(SKILLS, 'index') && target !== SKILLS;
  });
}

describe('the applications module and the skills module', () => {
  it('APP-08 recognizes an import of the interior of skills and accepts the public index', () => {
    const file = join(APPLICATIONS, 'application/applications.service.ts');

    expect(skillsInteriorImports(file, "import { SkillsCatalog } from '../../skills/index.js';")).toEqual([]);
    expect(skillsInteriorImports(file, "import { SkillsCatalog } from '../../skills/application/skills-catalog.js';")).toEqual([
      '../../skills/application/skills-catalog.js',
    ]);
    expect(skillsInteriorImports(file, "export { skills } from '../../skills/infra/schema.js';")).toHaveLength(1);
    expect(skillsInteriorImports(file, "const m = await import('../../skills/domain/ids.js');")).toHaveLength(1);
    expect(skillsInteriorImports(file, "import type { Skill } from '@am/contracts';")).toEqual([]);
  });

  it('APP-08 imports the skills module only through modules/skills/index in every file of modules/applications', () => {
    const offenders = sourcesUnder(APPLICATIONS).flatMap((file) =>
      skillsInteriorImports(file, readFileSync(file, 'utf8')).map((specifier) => `${relative(MODULES, file)} -> ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });

  it('APP-08 never names a table of the skills schema in the applications module', () => {
    const offenders = sourcesUnder(APPLICATIONS).filter((file) => /\bskills\.(skills|skill_aliases)\b|skill_aliases/.test(readFileSync(file, 'utf8')));

    expect(offenders.map((file) => relative(MODULES, file))).toEqual([]);
  });
});
