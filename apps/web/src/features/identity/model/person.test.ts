import { describe, expect, it } from 'vitest';
import { greetingFor, initialsOf } from './person';

describe('initialsOf', () => {
  it('takes the first two letters of the name in capitals', () => {
    expect(initialsOf('Marina Alves')).toBe('MA');
    expect(initialsOf('ana souza')).toBe('AN');
  });

  it('skips the spaces around and inside the name and keeps accents whole', () => {
    expect(initialsOf('  é a ')).toBe('ÉA');
  });

  it('gives one letter for a one-letter name and nothing for a name without letters', () => {
    expect(initialsOf('Z')).toBe('Z');
    expect(initialsOf('')).toBe('');
    expect(initialsOf('   ')).toBe('');
  });
});

describe('greetingFor', () => {
  it('greets the person by name', () => {
    expect(greetingFor('Ana Souza')).toBe('Olá, Ana Souza');
    expect(greetingFor('  Ana Souza ')).toBe('Olá, Ana Souza');
  });

  it('greets without a name when the session has none', () => {
    expect(greetingFor('')).toBe('Olá');
    expect(greetingFor('  ')).toBe('Olá');
  });
});
