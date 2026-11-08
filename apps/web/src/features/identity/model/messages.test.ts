import { describe, expect, it } from 'vitest';
import {
  areaOf,
  MESSAGES,
  minutesFromRetryAfter,
  problemMessage,
  safeRedirect,
} from './messages';

describe('problemMessage', () => {
  it('names a 401 as the wrong credentials, keeping the wording of the spec', () => {
    expect(problemMessage({ status: 401 })).toBe('E-mail ou senha incorretos.');
  });

  it('rounds the wait of a 429 up to whole minutes', () => {
    // 60 s is exactly one minute; anything above a minute rounds up, and a wait of a second is one minute.
    const cases: [number, string][] = [
      [1, 'Muitas tentativas. Tente novamente em 1 min.'],
      [59, 'Muitas tentativas. Tente novamente em 1 min.'],
      [60, 'Muitas tentativas. Tente novamente em 1 min.'],
      [61, 'Muitas tentativas. Tente novamente em 2 min.'],
      [95, 'Muitas tentativas. Tente novamente em 2 min.'],
      [900, 'Muitas tentativas. Tente novamente em 15 min.'],
    ];
    for (const [seconds, message] of cases) {
      expect(problemMessage({ status: 429, retryAfterSeconds: seconds }), `${seconds} s`).toBe(message);
    }
  });

  it('shows the unavailable message for a 429 without a usable wait', () => {
    expect(problemMessage({ status: 429 })).toBe(MESSAGES.unavailable);
  });

  it('names an unusable invitation and an unreachable api', () => {
    expect(problemMessage({ status: 410 })).toBe('Este convite expirou ou já foi usado. Peça um novo link a quem te convidou.');
    expect(problemMessage({ status: 503 })).toBe('Serviço indisponível. Tente novamente em instantes.');
  });

  it('shows the unavailable message for every status the screens do not name, never a raw problem title', () => {
    for (const status of [400, 403, 404, 409, 500]) {
      expect(problemMessage({ status }), `${status}`).toBe(MESSAGES.unavailable);
    }
  });

  it('never counts a fraction of a minute as zero', () => {
    expect(minutesFromRetryAfter(0)).toBe(1);
    expect(minutesFromRetryAfter(0.5)).toBe(1);
  });
});

describe('safeRedirect', () => {
  const fallback = '/admin';

  it('keeps a path of this app', () => {
    for (const path of ['/', '/admin', '/admin/invitations?cursor=abc', '/invite/token-1']) {
      expect(safeRedirect(path, fallback), path).toBe(path);
    }
  });

  it('falls back for absolute protocol-relative and backslash paths', () => {
    for (const path of [
      '//evil.test',
      '//evil.test/admin',
      '/\\evil.test',
      '/\\\\evil.test',
      'https://evil.test/admin',
      'http://evil.test',
      'javascript:alert(1)',
    ]) {
      expect(safeRedirect(path, fallback), path).toBe(fallback);
    }
  });

  it('falls back for a path that does not start with a slash', () => {
    for (const path of ['admin', '?redirect=/admin', '#admin', './admin']) {
      expect(safeRedirect(path, fallback), path).toBe(fallback);
    }
  });

  it('falls back for nothing at all', () => {
    expect(safeRedirect(undefined, fallback)).toBe(fallback);
    expect(safeRedirect('', fallback)).toBe(fallback);
  });

  it('falls back for a path carrying a control character or a space', () => {
    expect(safeRedirect('/admin\nHost: evil.test', fallback)).toBe(fallback);
    expect(safeRedirect('/admin /invitations', fallback)).toBe(fallback);
  });
});

describe('areaOf', () => {
  it('puts an admin in the admin area and a member in the product', () => {
    expect(areaOf('admin')).toBe('admin');
    expect(areaOf('member')).toBe('member');
  });
});
