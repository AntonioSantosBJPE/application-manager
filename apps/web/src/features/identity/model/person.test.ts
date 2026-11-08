import { describe, expect, it } from 'vitest';
import { greetingFor, initialsOf } from './person';

describe('initialsOf', () => {
  it('takes the first letter of the first and of the last name, in capitals', () => {
    expect(initialsOf('Ana Souza')).toBe('AS');
    expect(initialsOf('Marina Alves')).toBe('MA');
    expect(initialsOf('ana souza')).toBe('AS');
    expect(initialsOf('Maria da Silva Souza')).toBe('MS');
  });

  it('takes the first two letters of a single name', () => {
    expect(initialsOf('Ana')).toBe('AN');
    expect(initialsOf('ana')).toBe('AN');
  });

  it('skips the spaces around and between the names and keeps accents whole', () => {
    expect(initialsOf('  Ana   Souza ')).toBe('AS');
    expect(initialsOf('\tMaria \n da  Silva   Souza  ')).toBe('MS');
    expect(initialsOf('  Ana  ')).toBe('AN');
    expect(initialsOf('  é a ')).toBe('ÉA');
    expect(initialsOf('élida ávila')).toBe('ÉÁ');
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
