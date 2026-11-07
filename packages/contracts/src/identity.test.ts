import { describe, expect, it } from 'vitest';
import {
  acceptInvitationRequestSchema,
  createInvitationRequestSchema,
  createInvitationResponseSchema,
  emailSchema,
  invitationDetailsSchema,
  invitationsPageSchema,
  loginRequestSchema,
  meResponseSchema,
  nameSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  problemDetailsSchema,
} from './identity.js';

const invalid = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('passwordSchema', () => {
  it('rejects passwords of 11 and 129 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(invalid(passwordSchema, 'a'.repeat(11))).toBe(false);
    expect(invalid(passwordSchema, 'a'.repeat(129))).toBe(false);
  });

  it('accepts passwords of 12 and 128 characters', () => {
    expect(passwordSchema.parse('a'.repeat(12))).toBe('a'.repeat(12));
    expect(passwordSchema.parse('a'.repeat(128))).toBe('a'.repeat(128));
  });

  it('accepts any characters, with no composition rule', () => {
    expect(passwordSchema.parse('            ')).toBe('            ');
  });
});

describe('nameSchema', () => {
  it('rejects an empty or blank name and names above 120 characters', () => {
    expect(invalid(nameSchema, '')).toBe(false);
    expect(invalid(nameSchema, '   ')).toBe(false);
    expect(invalid(nameSchema, 'a'.repeat(121))).toBe(false);
  });

  it('accepts a name of 1 and of 120 characters, trimmed', () => {
    expect(nameSchema.parse('A')).toBe('A');
    expect(nameSchema.parse('a'.repeat(120))).toBe('a'.repeat(120));
    expect(nameSchema.parse('  Ana Souza  ')).toBe('Ana Souza');
  });
});

describe('emailSchema', () => {
  it('lowercases and trims before comparing', () => {
    expect(emailSchema.parse('  Admin@Example.COM ')).toBe('admin@example.com');
  });

  it('rejects a value that is not an email', () => {
    expect(invalid(emailSchema, 'not-an-email')).toBe(false);
    expect(invalid(emailSchema, '')).toBe(false);
  });
});

describe('loginRequestSchema', () => {
  it('normalizes the email and keeps an out-of-range password for the domain to reject', () => {
    expect(loginRequestSchema.parse({ email: ' Ana@Example.com ', password: 'a'.repeat(129) })).toEqual({
      email: 'ana@example.com',
      password: 'a'.repeat(129),
    });
  });

  it('rejects an empty password and a missing email', () => {
    expect(invalid(loginRequestSchema, { email: 'ana@example.com', password: '' })).toBe(false);
    expect(invalid(loginRequestSchema, { password: 'a'.repeat(12) })).toBe(false);
  });
});

describe('acceptInvitationRequestSchema', () => {
  it('rejects an out-of-range password and a blank or too long name', () => {
    for (const password of ['a'.repeat(11), 'a'.repeat(129)]) {
      expect(invalid(acceptInvitationRequestSchema, { name: 'Ana', password })).toBe(false);
    }
    for (const name of ['', '   ', 'a'.repeat(121)]) {
      expect(invalid(acceptInvitationRequestSchema, { name, password: 'a'.repeat(12) })).toBe(false);
    }
  });

  it('accepts the bounds of both fields', () => {
    expect(acceptInvitationRequestSchema.parse({ name: 'A', password: 'a'.repeat(12) })).toEqual({
      name: 'A',
      password: 'a'.repeat(12),
    });
    expect(acceptInvitationRequestSchema.parse({ name: 'a'.repeat(120), password: 'a'.repeat(128) })).toEqual({
      name: 'a'.repeat(120),
      password: 'a'.repeat(128),
    });
  });
});

describe('createInvitationRequestSchema', () => {
  it('normalizes the invited email', () => {
    expect(createInvitationRequestSchema.parse({ email: ' Novo@Example.com ' })).toEqual({
      email: 'novo@example.com',
    });
  });

  it('rejects a value that is not an email', () => {
    expect(invalid(createInvitationRequestSchema, { email: 'novo' })).toBe(false);
  });
});

describe('identity responses', () => {
  it('accepts the me body and rejects an unknown role', () => {
    const me = { id: '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60', email: 'ana@example.com', name: 'Ana', role: 'member' };

    expect(meResponseSchema.parse(me)).toEqual(me);
    expect(invalid(meResponseSchema, { ...me, role: 'owner' })).toBe(false);
  });

  it('accepts a created invitation with its absolute url and ISO expiry', () => {
    const created = {
      inviteUrl: 'http://localhost:3000/invite/abc',
      expiresAt: '2026-11-13T12:00:00.000Z',
    };

    expect(createInvitationResponseSchema.parse(created)).toEqual(created);
    expect(invalid(createInvitationResponseSchema, { ...created, inviteUrl: '/invite/abc' })).toBe(false);
    expect(invalid(createInvitationResponseSchema, { ...created, expiresAt: '2026-11-13' })).toBe(false);
  });

  it('accepts pending invitation details and strips an unknown token field', () => {
    const details = { email: 'novo@example.com', expiresAt: '2026-11-13T12:00:00.000Z' };

    expect(invitationDetailsSchema.parse(details)).toEqual(details);
    expect(invitationDetailsSchema.parse({ ...details, token: 'abc' })).toEqual(details);
  });

  it('accepts a page with a cursor and rejects a negative total', () => {
    const page = {
      items: [{ id: '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60', email: 'a@example.com', expiresAt: '2026-11-13T12:00:00.000Z' }],
      nextCursor: 'next',
      totalPending: 3,
    };

    expect(invitationsPageSchema.parse(page)).toEqual(page);
    expect(invitationsPageSchema.parse({ ...page, nextCursor: null }).nextCursor).toBeNull();
    expect(invalid(invitationsPageSchema, { ...page, totalPending: -1 })).toBe(false);
    expect(invalid(invitationsPageSchema, { ...page, nextCursor: undefined })).toBe(false);
  });
});

describe('problemDetailsSchema', () => {
  it('accepts a problem body with field errors named without values', () => {
    const problem = {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      errors: [{ path: 'password', code: 'too_big' }],
    };

    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
  });

  it('requires the status and leaves detail optional', () => {
    expect(problemDetailsSchema.parse({ type: 'about:blank', title: 'Unauthorized', status: 401 })).toEqual({
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
    });
    expect(invalid(problemDetailsSchema, { type: 'about:blank', title: 'Unauthorized' })).toBe(false);
  });
});
