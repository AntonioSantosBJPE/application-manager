/**
 * The letters in the avatar: the first letter of the first and of the last name, in capitals
 * ("Ana Souza" → "AS"); a single name gives its first two letters ("Ana" → "AN"). Only letters count:
 * punctuation, digits and emoji are skipped, and a word without a letter is not a name
 * ("(Ana) Souza" → "AS", "👩‍💻 Ana" → "AN"). A name with no letters (the session carries none)
 * draws the avatar empty.
 */
export function initialsOf(name: string): string {
  const names = name
    .normalize('NFC')
    .split(/\s+/u)
    .map((word) => Array.from(word).filter((character) => /\p{L}/u.test(character)))
    .filter((letters) => letters.length > 0);
  const first = names[0];
  const last = names.at(-1);
  if (first === undefined || last === undefined) return '';
  const letters = names.length === 1 ? first.slice(0, 2) : [first[0], last[0]];
  return letters.join('').toLocaleUpperCase('pt-BR');
}

/** The greeting of the home: "Olá, Ana Souza", or just "Olá" when the session has no name. */
export function greetingFor(name: string): string {
  const trimmed = name.trim();
  return trimmed === '' ? 'Olá' : `Olá, ${trimmed}`;
}
