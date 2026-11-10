import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULES = resolve(import.meta.dirname, '../..');
const RESUME = join(MODULES, 'resume');
const SKILLS = join(MODULES, 'skills');

const THIS_FILE = join(RESUME, 'domain/skills-boundary.test.ts');

/** Every `.ts` file under `directory`, tests included: a test of resume may not reach into the interior of skills either. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

/** The source files only: an integration test reads the seed skills from the database to build its requests. */
const sourcesUnder = (directory: string): string[] => filesUnder(directory).filter((file) => !/\.test\.ts$/.test(file));

/** The module specifiers a source imports, exports from or loads dynamically. */
function specifiersOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1]!);
}

/** The imports of `source`, written in `file`, that reach into the skills module by a path other than its `index`. */
export function skillsInteriorImports(file: string, source: string): string[] {
  return specifiersOf(source).filter((specifier) => {
    const absolute = !specifier.startsWith('.');
    if (absolute) return /modules\/skills\/./.test(specifier) && !/modules\/skills\/index(\.js|\.ts)?$/.test(specifier);
    const target = resolve(dirname(file), specifier).replace(/\.(js|ts)$/, '');
    return target.startsWith(`${SKILLS}/`) && target !== join(SKILLS, 'index');
  });
}

describe('the resume module and the skills module', () => {
  it('RES-32 recognizes every way a file of resume could import the interior of skills, and accepts the public index', () => {
    const file = join(RESUME, 'application/resume.service.ts');

    expect(skillsInteriorImports(file, "import { SkillsCatalog } from '../../skills/index.js';")).toEqual([]);
    expect(skillsInteriorImports(file, "import { SkillsModule } from '../skills/index.js';")).toEqual([]);
    expect(skillsInteriorImports(file, "import { SkillsCatalog } from '../../skills/application/skills-catalog.js';")).toHaveLength(1);
    expect(skillsInteriorImports(file, "export { skills } from '../../skills/infra/schema.js';")).toHaveLength(1);
    expect(skillsInteriorImports(file, "const m = await import('../../skills/domain/ids.js');")).toHaveLength(1);
    expect(skillsInteriorImports(file, "import { skills } from 'src/modules/skills/infra/schema.js';")).toHaveLength(1);
    expect(skillsInteriorImports(file, "import { SkillsCatalog } from 'src/modules/skills/index.js';")).toEqual([]);
    expect(skillsInteriorImports(file, "import type { Skill } from '@am/contracts';")).toEqual([]);
    expect(skillsInteriorImports(file, "import { isUuid } from '../domain/ids.js';")).toEqual([]);
  });

  it('RES-32 imports the skills module only through modules/skills/index in every file of modules/resume', () => {
    // This file holds the sample imports of the check above as strings, so it is the one file left out.
    const offenders = filesUnder(RESUME)
      .filter((file) => file !== THIS_FILE)
      .flatMap((file) =>
      skillsInteriorImports(file, readFileSync(file, 'utf8')).map((specifier) => `${relative(MODULES, file)} -> ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });

  it('RES-32 control: the service does import the skills module, through its index, so the checks above are not passing over nothing', () => {
    const service = readFileSync(join(RESUME, 'application/resume.service.ts'), 'utf8');

    expect(specifiersOf(service)).toContain('../../skills/index.js');
  });

  it('RES-32 never names a table of the skills schema in the resume module', () => {
    const offenders = sourcesUnder(RESUME).filter((file) => /\bskills\.(skills|skill_aliases)\b|skill_aliases/.test(readFileSync(file, 'utf8')));

    expect(offenders.map((file) => relative(MODULES, file))).toEqual([]);
  });
});
