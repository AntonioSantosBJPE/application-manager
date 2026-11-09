import { describe, expect, it } from 'vitest';
import { searchPatternOf, searchTextOf } from './search-text.js';

/** What Postgres `LIKE` does with the pattern: `%` is any run, `_` any one character, `\` escapes. */
function like(text: string, pattern: string): boolean {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;
    if (char === '\\') {
      index += 1;
      source += pattern[index]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (char === '%') source += '[\\s\\S]*';
    else if (char === '_') source += '[\\s\\S]';
    else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`).test(text);
}

describe('searchTextOf', () => {
  it('APP-13 keeps company and title apart, each without accent, case or extra spaces', () => {
    expect(searchTextOf('Saúde  Ágil', ' Pleno ')).toBe('saude agil\npleno');
    expect(searchTextOf('Empresa Fictícia Alfa', 'Vaga de Teste Pleno')).toBe('empresa ficticia alfa\nvaga de teste pleno');
  });
});

describe('searchPatternOf', () => {
  it('APP-13 finds "saude" in the text of "Saúde Ágil" and "Pleno" whatever the case and the accent of q', () => {
    const text = searchTextOf('Saúde Ágil', 'Pleno');

    expect(like(text, searchPatternOf('saude'))).toBe(true);
    expect(like(text, searchPatternOf('SAÚDE'))).toBe(true);
    expect(like(text, searchPatternOf('  ágil  '))).toBe(true);
    expect(like(text, searchPatternOf('agil pleno'))).toBe(false);
    expect(like(text, searchPatternOf('  ágil   pleno '))).toBe(false);
    expect(like(text, searchPatternOf('financeira'))).toBe(false);
  });

  it('APP-13 wraps the normalized q in % on both sides', () => {
    expect(searchPatternOf('Saúde')).toBe('%saude%');
  });

  it('APP-13 escapes %, _ and \\ so they match themselves and not everything', () => {
    expect(searchPatternOf('100%')).toBe('%100\\%%');
    expect(searchPatternOf('a_b')).toBe('%a\\_b%');
    expect(searchPatternOf('a\\b')).toBe('%a\\\\b%');
    const text = searchTextOf('Empresa 100% Fictícia', 'Vaga a_b');

    expect(like(text, searchPatternOf('100%'))).toBe(true);
    expect(like(text, searchPatternOf('%'))).toBe(true);
    expect(like(searchTextOf('Empresa Alfa', 'Vaga'), searchPatternOf('%'))).toBe(false);
    expect(like(searchTextOf('Empresa Alfa', 'Vaga'), searchPatternOf('_'))).toBe(false);
    expect(like(text, searchPatternOf('a_b'))).toBe(true);
    expect(like(searchTextOf('Empresa Alfa', 'Vaga axb'), searchPatternOf('a_b'))).toBe(false);
  });
});
