/**
 * Text as the search compares it: Unicode NFKD, combining marks removed, lowercase, runs of white
 * space reduced to one space and the ends trimmed. Both the stored `search_text` and the pattern of
 * `q` go through it, so "Saúde" and "saude" are the same text without the `unaccent` extension (APP-13).
 */
function normalizeSearchText(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The value of `job_postings.search_text`: the company and the title, normalized. */
export function searchTextOf(company: string, title: string): string {
  return normalizeSearchText(`${company} ${title}`);
}

/**
 * The `LIKE` pattern that finds `q` inside a `search_text`. `%`, `_` and `\` in `q` are escaped, so
 * they match themselves instead of acting as wildcards.
 */
export function searchPatternOf(q: string): string {
  const escaped = normalizeSearchText(q).replace(/[\\%_]/g, (char) => `\\${char}`);
  return `%${escaped}%`;
}
