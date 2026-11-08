import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';

type Media = { name: 'prefers-color-scheme' | 'prefers-reduced-motion'; value: string };

/** Emulates the operating system preferences in Chromium, as a person's settings would. */
async function emulate(...features: Media[]): Promise<void> {
  await cdp().send('Emulation.setEmulatedMedia', { features });
}

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/** What the page paints right now: the body background and text, the two theme anchors. */
function painted(): { background: string; text: string } {
  const style = getComputedStyle(document.body);
  return { background: style.backgroundColor, text: style.color };
}

// The values of tokens.json, as the browser resolves them.
const light = () => ({
  background: resolvedColor('oklch(0.99 0.002 250)'),
  text: resolvedColor('oklch(0.21 0.012 250)'),
});
const dark = () => ({
  background: resolvedColor('oklch(0.165 0.005 250)'),
  text: resolvedColor('oklch(0.955 0.003 250)'),
});

afterEach(async () => {
  document.documentElement.removeAttribute('data-theme');
  await emulate();
});

describe('Prumo tokens in the browser', () => {
  it('PRU-01 AC05 applies the dark values when the system prefers dark and data-theme is not light', async () => {
    await emulate({ name: 'prefers-color-scheme', value: 'light' });
    expect(painted()).toEqual(light());

    await emulate({ name: 'prefers-color-scheme', value: 'dark' });
    expect(painted()).toEqual(dark());

    document.documentElement.setAttribute('data-theme', 'light');
    expect(painted()).toEqual(light());
  });

  it('PRU-01 AC06 lets data-theme force the theme whatever the system prefers', async () => {
    for (const preference of ['light', 'dark']) {
      await emulate({ name: 'prefers-color-scheme', value: preference });

      document.documentElement.setAttribute('data-theme', 'dark');
      expect(painted(), `data-theme=dark, system ${preference}`).toEqual(dark());

      document.documentElement.setAttribute('data-theme', 'light');
      expect(painted(), `data-theme=light, system ${preference}`).toEqual(light());
    }
  });

  it('PRU-01 AC10 paints the base text at 13/20 and the scale at the sizes of tokens.json', () => {
    const body = getComputedStyle(document.body);
    expect(body.fontSize).toBe('13px');
    expect(body.lineHeight).toBe('20px');

    const scale = {
      'text-caption': ['12px', '16px'],
      'text-label': ['12px', '16px'],
      'text-body': ['13px', '20px'],
      'text-body-lg': ['14px', '22px'],
      'text-heading-sm': ['13px', '20px'],
      'text-heading-md': ['15px', '22px'],
      'text-heading-lg': ['18px', '26px'],
      'text-heading-xl': ['24px', '32px'],
    };
    render(
      <div>
        {Object.keys(scale).map((name) => (
          <p key={name} data-testid={name} className={name}>
            Texto
          </p>
        ))}
      </div>,
    );
    for (const [name, [size, lineHeight]] of Object.entries(scale)) {
      const style = getComputedStyle(screen.getByTestId(name));
      expect([style.fontSize, style.lineHeight], name).toEqual([size, lineHeight]);
    }
  });

  it('PRU-01 base sets tabular figures on font-mono', () => {
    render(
      <p data-testid="mono" className="font-mono">
        08 nov 2026
      </p>,
    );
    expect(getComputedStyle(screen.getByTestId('mono')).fontVariantNumeric).toBe('tabular-nums');
  });

  it('PRU-01 AC12 runs no transition or animation when the person prefers reduced motion', async () => {
    render(
      <div data-testid="moving" className="animate-spin transition-colors duration-200">
        Texto
      </div>,
    );
    const moving = screen.getByTestId('moving');

    await emulate({ name: 'prefers-reduced-motion', value: 'no-preference' });
    expect(getComputedStyle(moving).transitionDuration).toBe('0.2s');
    expect(getComputedStyle(moving).animationName).not.toBe('none');

    await emulate({ name: 'prefers-reduced-motion', value: 'reduce' });
    expect(getComputedStyle(moving).transitionProperty).toBe('none');
    expect(getComputedStyle(moving).animationName).toBe('none');
    expect(moving.getAnimations()).toEqual([]);
  });

  it('PRU-01 AC13 draws a 2px solid focus ring offset 2px on an element reached by keyboard', async () => {
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      const { unmount } = render(<a href="#destino">Destino {theme}</a>);
      const link = screen.getByRole('link', { name: `Destino ${theme}` });

      link.blur();
      await userEvent.tab();
      expect(link).toBe(document.activeElement);

      const style = getComputedStyle(link);
      expect(style.outlineStyle, theme).toBe('solid');
      expect(style.outlineWidth, theme).toBe('2px');
      expect(style.outlineOffset, theme).toBe('2px');
      const accent = theme === 'light' ? 'oklch(0.5 0.08 195)' : 'oklch(0.74 0.105 195)';
      expect(style.outlineColor, theme).toBe(resolvedColor(accent));
      unmount();
    }
  });
});
