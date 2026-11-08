import type { ApiFailure } from '../../../lib/bff';
import { SKILLS_MESSAGES } from './messages';

/** The field a failed save blames and what the field says. */
export interface FieldFailure {
  field: string;
  message: string;
}

/**
 * Which field of a form dialog a failed save belongs to (SKL-49, SKL-73, SKL-75). A `409` is the name
 * clash, written on the field that clashes; a `400` is the field the api named, or `defaultField` when
 * it named none we know. Anything else is not about a field, so the dialog says the service is unavailable.
 */
export function fieldFailureOf(
  failure: ApiFailure,
  options: { conflict: FieldFailure; fields: readonly string[]; defaultField: string },
): FieldFailure | undefined {
  if (failure.status === 409) return options.conflict;
  if (failure.status !== 400) return undefined;
  const named = failure.problem?.errors?.find((error) => options.fields.includes(error.path));
  return { field: named?.path ?? options.defaultField, message: SKILLS_MESSAGES.invalidText };
}
