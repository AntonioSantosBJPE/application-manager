/**
 * The letters in the avatar: the first letter of the first and of the last name, in capitals
 * ("Ana Souza" → "AS"); a single name gives its first two letters ("Ana" → "AN"). A name with no
 * letters (the session carries none) draws the avatar empty.
 */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== '');
  const first = words[0];
  const last = words.at(-1);
  if (first === undefined || last === undefined) return '';
  const letters =
    words.length === 1
      ? Array.from(first).slice(0, 2)
      : [Array.from(first)[0], Array.from(last)[0]];
  return letters.join('').toLocaleUpperCase('pt-BR');
}

/** The greeting of the home: "Olá, Ana Souza", or just "Olá" when the session has no name. */
export function greetingFor(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? 'Olá' : `Olá, ${trimmed}`;
}
