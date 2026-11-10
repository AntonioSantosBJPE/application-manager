import type { z } from 'zod';
import { RESUME_MESSAGES } from './messages';

/** What a field says under itself when its value cannot be sent, in the words of the page (RES-47, RES-85). */
export const FIELD_MESSAGES = {
  required: 'Preencha este campo.',
  tooLong: (max: number) => `Use no máximo ${max} caracteres.`,
  email: 'Informe um e-mail válido.',
  link: 'Use um link que comece com http:// ou https://.',
  month: 'Informe o mês e o ano.',
  control: 'Remova os caracteres de controle.',
  invalid: 'Valor inválido.',
} as const;

// The messages of the contracts schemas, which are English and never shown: they only say which rule fired.
const CONTRACT_RULES: Record<string, string> = {
  'Invalid email': FIELD_MESSAGES.email,
  'The link must start with http:// or https://': FIELD_MESSAGES.link,
  'The month must be YYYY-MM': FIELD_MESSAGES.month,
  'The end must not be before the start': RESUME_MESSAGES.endBeforeStart,
  'Control characters are not allowed': FIELD_MESSAGES.control,
};

/** The pt-BR message of one issue of a contracts schema. */
export function issueMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === 'too_big') return FIELD_MESSAGES.tooLong(Number(issue.maximum));
  if (issue.code === 'too_small') return FIELD_MESSAGES.required;
  return CONTRACT_RULES[issue.message] ?? FIELD_MESSAGES.invalid;
}

/**
 * Checks `input` against the schema of the contracts, the same one the api uses, and answers the message
 * of the first issue about the field (`belongs` says which paths are the field's), or `null` when the field
 * may be sent. An issue about another field is not this field's to show.
 */
export function messageFor(
  schema: z.ZodType,
  input: unknown,
  belongs: (path: readonly PropertyKey[]) => boolean,
): string | null {
  const result = schema.safeParse(input);
  if (result.success) return null;
  const issue = result.error.issues.find((candidate) => belongs(candidate.path));
  return issue === undefined ? null : issueMessage(issue);
}

/** The message of the first issue of each field (the first key of the path), for a form that shows every field at once. */
export function fieldMessages(schema: z.ZodType, input: unknown): Record<string, string> {
  const result = schema.safeParse(input);
  if (result.success) return {};
  const messages: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const name = String(issue.path[0] ?? '');
    if (name !== '' && messages[name] === undefined) messages[name] = issueMessage(issue);
  }
  return messages;
}
