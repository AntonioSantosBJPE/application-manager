import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Route } from './__root';

type Head = NonNullable<typeof Route.options.head>;
const head = await Route.options.head?.({} as Parameters<Head>[0]);
const publicDir = resolve(import.meta.dirname, '../../public');

describe('root head', () => {
  it('PRU-05 AC06 sets the document title to Rumo Carreira', () => {
    expect(head?.meta).toContainEqual({ title: 'Rumo Carreira' });
  });

  it('PRU-05 AC05 links a favicon that follows the color scheme and an app icon, both served from public', () => {
    const icon = head?.links?.find((link) => link?.rel === 'icon');
    const appIcon = head?.links?.find((link) => link?.rel === 'apple-touch-icon');

    expect(icon).toMatchObject({ type: 'image/svg+xml', href: '/favicon.svg' });
    expect(appIcon).toMatchObject({ href: '/app-icon.svg' });
    for (const file of ['favicon.svg', 'app-icon.svg']) {
      expect(existsSync(resolve(publicDir, file))).toBe(true);
    }
    // The favicon swaps its own ink with the scheme of the browser (docs/design/system/assets/logos).
    expect(readFileSync(resolve(publicDir, 'favicon.svg'), 'utf8')).toContain(
      'prefers-color-scheme:dark',
    );
  });
});
