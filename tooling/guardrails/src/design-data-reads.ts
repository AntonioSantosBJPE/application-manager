/**
 * The `## Data Reads` section every feature design carries (AD-028): one row per read a screen or a job
 * makes, saying what it uses, what it receives, how big it gets at the worst case and whether it ends up
 * in the server-rendered HTML. Writing the row is what makes an over-read visible before the code exists.
 */

export const DATA_READS_HEADING = '## Data Reads';

export const DATA_READS_COLUMNS = ['Consumer', 'Endpoint', 'Uses', 'Returns', 'Worst case', 'In the HTML'] as const;

/** Features designed before AD-028; their designs predate the section and are not rewritten. */
export const DESIGNS_BEFORE_DATA_READS = new Set([
  'walking-skeleton',
  'identity',
  'prumo-design-system',
  'skills',
  'application',
  'production-deploy',
]);

const cellsOf = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const isSeparator = (cells: string[]) => cells.every((cell) => /^:?-{3,}:?$/.test(cell));

/**
 * What is wrong with the `## Data Reads` section of a design, one sentence per problem; empty when it
 * holds. The section needs the table with the columns of `DATA_READS_COLUMNS` in that order, at least one
 * row, no empty cell, and a number in every "Worst case" (rows, items, KB): "pequeno" is not a bound.
 */
export function dataReadsProblems(design: string): string[] {
  const lines = design.split('\n');
  const start = lines.findIndex((line) => line.trim() === DATA_READS_HEADING);
  if (start === -1) return [`missing the "${DATA_READS_HEADING}" section`];

  const section: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,2} /.test(line)) break;
    section.push(line);
  }
  const table = section.filter((line) => line.trim().startsWith('|'));
  if (table.length === 0) return ['the section has no table'];

  const [header = '', separator = '', ...rows] = table;
  const columns = cellsOf(header);
  const problems: string[] = [];
  if (columns.join(' | ') !== DATA_READS_COLUMNS.join(' | ')) {
    problems.push(`the table columns must be: ${DATA_READS_COLUMNS.join(' | ')}`);
    return problems;
  }
  if (!isSeparator(cellsOf(separator))) problems.push('the second line of the table is not a separator');
  if (rows.length === 0) problems.push('the table has no read');

  const worstCase = DATA_READS_COLUMNS.indexOf('Worst case');
  rows.forEach((row, index) => {
    const cells = cellsOf(row);
    const name = `row ${index + 1}`;
    if (cells.length !== DATA_READS_COLUMNS.length) {
      problems.push(`${name} has ${cells.length} cells instead of ${DATA_READS_COLUMNS.length}`);
      return;
    }
    cells.forEach((cell, column) => {
      if (cell === '' || cell === '-' || cell === '—') problems.push(`${name}: "${DATA_READS_COLUMNS[column]}" is empty`);
    });
    if (!/\d/.test(cells[worstCase] ?? '')) problems.push(`${name}: "Worst case" needs a number (rows, items or KB)`);
  });
  return problems;
}
