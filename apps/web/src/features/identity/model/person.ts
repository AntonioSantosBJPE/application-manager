/**
 * The letters in the avatar: the first two letters of the name, in capitals. A name with no letters
 * (the session carries none) draws the avatar empty.
 */
export function initialsOf(name: string): string {
  return Array.from(name.trim().replace(/\s+/gu, '')).slice(0, 2).join('').toLocaleUpperCase('pt-BR');
}

/** The greeting of the home: "Olá, Ana Souza", or just "Olá" when the session has no name. */
export function greetingFor(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? 'Olá' : `Olá, ${trimmed}`;
}
