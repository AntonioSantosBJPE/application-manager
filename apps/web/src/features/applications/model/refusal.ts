import { problemMessage, type Failure } from '../../identity';
import { DETAIL_MESSAGES, REFUSAL_MESSAGES } from './messages';

/**
 * The line a screen of applications shows for a failed call. A refusal of the api says what was refused
 * (`400` the fields, `404` the application, `422` the skills); a `5xx` or a network failure stays the
 * unavailable message, because the person can only try again (APP-55, APP-64, APP-78).
 */
export function refusalMessage(failure: Failure): string {
  if (failure.status === 400) return REFUSAL_MESSAGES.fields;
  if (failure.status === 404) return DETAIL_MESSAGES.notFound;
  if (failure.status === 422) return REFUSAL_MESSAGES.skills;
  return problemMessage(failure);
}

const REFUSED_FIELDS = ['company', 'title', 'url', 'level'] as const;

/** The fields of the new application dialog a `400` can name (the first segment of the path of each error). */
export type RefusedField = (typeof REFUSED_FIELDS)[number];

/** The fields the Problem Details of a `400` names, so the dialog shows the error under each one. */
export function refusedFieldsOf(failure: Failure): RefusedField[] {
  if (failure.status !== 400) return [];
  const named = (failure.problem?.errors ?? []).map((error) => error.path.split('.')[0]);
  return REFUSED_FIELDS.filter((field) => named.includes(field));
}
