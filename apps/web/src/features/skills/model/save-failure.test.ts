import { describe, expect, it } from 'vitest';
import { fieldFailureOf } from './save-failure';

const options = {
  conflict: { field: 'name', message: 'Já existe uma skill ou apelido com esse nome.' },
  fields: ['name', 'category'],
  defaultField: 'name',
};

describe('fieldFailureOf', () => {
  it('SKL-73 blames the conflicting field on a 409 with the words of the conflict', () => {
    expect(fieldFailureOf({ ok: false, status: 409 }, options)).toEqual(options.conflict);
  });

  it('SKL-73 blames the field the api named on a 400', () => {
    const problem = {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      errors: [{ path: 'category', code: 'invalid_value' }],
    };

    expect(fieldFailureOf({ ok: false, status: 400, problem }, options)).toEqual({
      field: 'category',
      message: 'Use de 1 a 60 caracteres, com ao menos uma letra ou número.',
    });
  });

  it('SKL-73 falls back to the default field when a 400 names no known field', () => {
    const problem = { type: 'about:blank', title: 'Bad Request', status: 400, errors: [{ path: 'other', code: 'x' }] };

    expect(fieldFailureOf({ ok: false, status: 400, problem }, options)?.field).toBe('name');
    expect(fieldFailureOf({ ok: false, status: 400 }, options)?.field).toBe('name');
  });

  it('SKL-73 blames no field for a failure that is not about the form', () => {
    expect(fieldFailureOf({ ok: false, status: 503 }, options)).toBeUndefined();
    expect(fieldFailureOf({ ok: false, status: 404 }, options)).toBeUndefined();
  });
});
