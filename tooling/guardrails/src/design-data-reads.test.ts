import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataReadsProblems, DESIGNS_BEFORE_DATA_READS } from './design-data-reads.js';
import { repoRoot, run } from './repo.js';

const table = (...rows: string[]) =>
  [
    '# Some Design',
    '',
    '## Data Reads',
    '',
    '| Consumer | Endpoint | Uses | Returns | Worst case | In the HTML |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Risks & Concerns',
    '',
    '| Concern | Mitigation |',
    '|---|---|',
    '| a | b |',
  ].join('\n');

const goodRow = '| Home, passo 02 | `GET /resume/summary` | se está pronto | `{ ready }` | 1 linha | só `ready` |';

describe('the Data Reads section of a design (AD-028)', () => {
  it('holds when every read names what it uses, what it returns and a numeric worst case, ignoring the tables of the next section', () => {
    expect(dataReadsProblems(table(goodRow))).toEqual([]);
  });

  it('refuses a design without the section', () => {
    expect(dataReadsProblems('# Design\n\n## Components\n')).toEqual(['missing the "## Data Reads" section']);
  });

  it('refuses a section with no table or no row', () => {
    expect(dataReadsProblems('## Data Reads\n\nNada a ler.\n')).toEqual(['the section has no table']);
    expect(dataReadsProblems(table())).toEqual(['the table has no read']);
  });

  it('refuses other columns', () => {
    const design = '## Data Reads\n\n| Tela | Endpoint |\n|---|---|\n| a | b |\n';
    expect(dataReadsProblems(design)).toEqual([
      'the table columns must be: Consumer | Endpoint | Uses | Returns | Worst case | In the HTML',
    ]);
  });

  it('refuses an empty cell and a worst case without a number', () => {
    expect(dataReadsProblems(table('| Home | `GET /resume` |  | o currículo | pequeno | — |'))).toEqual([
      'row 1: "Uses" is empty',
      'row 1: "In the HTML" is empty',
      'row 1: "Worst case" needs a number (rows, items or KB)',
    ]);
  });

  it('every feature design written since AD-028 carries the section', () => {
    const designs = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '.specs/features'], {
      cwd: repoRoot,
    })
      .output.split('\0')
      .filter((file) => /^\.specs\/features\/[^/]+\/design\.md$/.test(file) && existsSync(join(repoRoot, file)))
      .filter((file) => !DESIGNS_BEFORE_DATA_READS.has(file.split('/')[2]!));

    const problems = designs.flatMap((file) =>
      dataReadsProblems(readFileSync(join(repoRoot, file), 'utf8')).map((problem) => `${file}: ${problem}`),
    );

    expect(problems).toEqual([]);
  });
});
