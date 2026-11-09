import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MODULES = resolve(import.meta.dirname, '../..');
const APPLICATIONS = join(MODULES, 'applications');
const SKILLS = join(MODULES, 'skills');

/** Every `.ts` file under `directory`, tests included: a test of `skills` may not reach into `applications` either. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(path);
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : [];
  });
}

/** The module specifiers a source imports, exports from or loads dynamically. */
function specifiersOf(source: string): string[] {
  return [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1]!);
}

/** The imports of `source`, written in `file`, that reach anything of the applications module, its `index` included. */
export function applicationsImports(file: string, source: string): string[] {
  return specifiersOf(source).filter((specifier) => {
    if (!specifier.startsWith('.')) return /modules\/applications(\/|$)/.test(specifier);
    const target = resolve(dirname(file), specifier).replace(/\.(js|ts)$/, '');
    return target === APPLICATIONS || target.startsWith(`${APPLICATIONS}/`);
  });
}

describe('the skills module and the applications module', () => {
  it('APP-85 recognizes every way a file of skills could import the applications module, and accepts what it may import', () => {
    const file = join(SKILLS, 'application/skills-admin.service.ts');

    expect(applicationsImports(file, "import { ApplicationsModule } from '../../applications/index.js';")).toHaveLength(1);
    expect(applicationsImports(file, "import { jobPostings } from '../../applications/infra/schema.js';")).toHaveLength(1);
    expect(applicationsImports(file, "export * from '../../applications/index.js';")).toHaveLength(1);
    expect(applicationsImports(file, "const m = await import('../../applications/domain/ids.js');")).toHaveLength(1);
    expect(applicationsImports(file, "import { x } from '../../applications';")).toHaveLength(1);
    expect(applicationsImports(file, "import { x } from 'src/modules/applications/index.js';")).toHaveLength(1);
    expect(applicationsImports(file, "import { SKILL_USAGE } from '../domain/skill-usage.js';")).toEqual([]);
    expect(applicationsImports(file, "import { Inject } from '@nestjs/common';")).toEqual([]);
    expect(applicationsImports(file, "import { x } from '../../identity/index.js';")).toEqual([]);
  });

  it('APP-85 imports nothing of modules/applications in any file of modules/skills: the port goes from applications to skills only', () => {
    const offenders = filesUnder(SKILLS).flatMap((file) =>
      applicationsImports(file, readFileSync(file, 'utf8')).map((specifier) => `${relative(MODULES, file)} -> ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });

  it('APP-85 keeps the port in skills: SkillUsage and SKILL_USAGE are exported by its index, and applications implements it through that index', () => {
    const index = readFileSync(join(SKILLS, 'index.ts'), 'utf8');
    const usage = readFileSync(join(APPLICATIONS, 'application/applications-skill-usage.ts'), 'utf8');

    expect(index).toMatch(/SKILL_USAGE/);
    expect(index).toMatch(/SkillUsage/);
    expect(specifiersOf(usage)).toContain('../../skills/index.js');
    expect(readFileSync(join(SKILLS, 'domain/skill-usage.ts'), 'utf8')).toMatch(/countFor\(skillIds: readonly string\[\]\): Promise<Map<string, number>>/);
  });
});
