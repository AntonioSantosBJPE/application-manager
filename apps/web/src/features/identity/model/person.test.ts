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

describe('initialsOf with characters that are not letters', () => {
  it('PRU-06 AC13 takes the first letter of each name, skipping punctuation', () => {
    expect(initialsOf('(Ana) Souza')).toBe('AS');
    expect(initialsOf('Ana "Souza"')).toBe('AS');
    expect(initialsOf("D'Ávila Souza")).toBe('DS');
  });

  it('PRU-06 AC13 skips an emoji and a word without letters', () => {
    expect(initialsOf('👩‍💻 Ana Souza')).toBe('AS');
    expect(initialsOf('Ana Souza 👩‍💻')).toBe('AS');
    expect(initialsOf('👩‍💻 Ana')).toBe('AN');
    expect(initialsOf('Ana - Souza')).toBe('AS');
  });

  it('PRU-06 AC13 takes the first two letters of a single name, skipping what is not a letter', () => {
    expect(initialsOf('(Ana)')).toBe('AN');
    expect(initialsOf('A.na')).toBe('AN');
  });

  it('PRU-06 AC13 draws no initials when no word has a letter', () => {
    expect(initialsOf('👩‍💻')).toBe('');
    expect(initialsOf('(123) -')).toBe('');
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
