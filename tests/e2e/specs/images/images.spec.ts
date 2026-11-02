import { expect, test } from '@playwright/test';
import { buildImage, run, runOk, sh } from '../../support/docker.js';

// IMG-01..04: each production image is inspected the way a registry consumer would see it.
const images = [
  { app: 'api', tag: 'am-e2e-api:images' },
  { app: 'web', tag: 'am-e2e-web:images' },
] as const;
const [api, web] = images;

test.beforeAll(() => {
  test.setTimeout(15 * 60_000);
  for (const { app, tag } of images) buildImage(app, tag);
});

/** Directories of a scope inside any node_modules of the image (the pnpm virtual store included). */
function scopeDirectories(tag: string, scope: string): string[] {
  const result = sh(tag, `find / -xdev \\( -name '${scope}' -o -name '${scope}+*' \\) -path '*node_modules*' 2>/dev/null`);
  return result.output.split('\n').filter(Boolean);
}

test.describe('images', () => {
  test('api image has no @tanstack package', () => {
    // Control: the scope the api does use is found by the same search, so an empty result is not a blind search.
    expect(scopeDirectories(api.tag, '@nestjs').length).toBeGreaterThan(0);
    expect(scopeDirectories(api.tag, '@tanstack')).toEqual([]);
  });

  test('web image has no @nestjs package', () => {
    // Control: the scope the web does use is found by the same search.
    expect(scopeDirectories(web.tag, '@tanstack').length).toBeGreaterThan(0);
    expect(scopeDirectories(web.tag, '@nestjs')).toEqual([]);
  });

  test('web and api run as a non-root user', () => {
    for (const { tag } of images) {
      const configured = runOk('docker', ['image', 'inspect', '--format', '{{.Config.User}}', tag]).trim();
      expect(['', 'root', '0']).not.toContain(configured);
      const uid = sh(tag, 'id -u').output.trim();
      expect(uid).not.toBe('0');
    }
  });

  test('web and api contain no .env file', () => {
    for (const { tag } of images) {
      // Control: the search runs on a filesystem that holds the app, so an empty result is not a blind search.
      expect(sh(tag, 'test -f /app/package.json').status).toBe(0);
      const result = sh(tag, `find / -xdev \\( -name '.env' -o -name '.env.*' \\) -not -path '*/node_modules/*' 2>/dev/null`);
      expect(result.output.trim()).toBe('');
    }
  });

  test('api image contains the main and migrate entrypoints and the migrations', () => {
    const result = run('docker', [
      'run', '--rm', '--entrypoint', 'sh', api.tag, '-c',
      'test -f dist/main.js && test -f dist/migrate.js && test -f drizzle/0000_require_postgres_18.sql',
    ]);
    expect(result.status).toBe(0);
  });
});
