import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { settle } from '../../testing/contrast';
import { FormPage } from './form-page';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function renderPage(sections = 2) {
  return render(
    <FormPage.Root>
      <FormPage.Index aria-label="Seções do currículo">
        <a href="#s0">Perfil</a>
        <a href="#s1">Experiência</a>
      </FormPage.Index>
      <FormPage.Content>
        {Array.from({ length: sections }, (_, index) => (
          <FormPage.Section
            key={index}
            id={`s${index}`}
            title={index === 0 ? 'Perfil' : `Seção ${index}`}
            actions={index === 0 ? <button type="button">Adicionar item</button> : undefined}
          >
            <div style={{ height: 600 }}>Campos</div>
          </FormPage.Section>
        ))}
      </FormPage.Content>
      <FormPage.Actions>
        <button type="button">Visualizar PDF</button>
      </FormPage.Actions>
    </FormPage.Root>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('FormPage in the browser', () => {
  it('PRU-07 AC10 measures the index 200px and the sections at most 720px, with the index beside them', async () => {
    await page.viewport(1440, 900);
    renderPage();
    const index = screen.getByRole('navigation').getBoundingClientRect();
    const section = screen.getByRole('region', { name: 'Perfil' }).getBoundingClientRect();

    expect(index.width).toBe(200);
    expect(section.width).toBe(720);
    expect(index.right).toBeLessThanOrEqual(section.left);
    expect(index.top).toBe(section.top);
  });

  it('PRU-07 AC10 keeps the index in view while the sections scroll', async () => {
    await page.viewport(1440, 900);
    renderPage(4);
    const index = screen.getByRole('navigation');
    const before = index.getBoundingClientRect().top;

    window.scrollTo(0, 800);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(getComputedStyle(index).position).toBe('sticky');
    expect(window.scrollY).toBeGreaterThan(0);
    // It starts 24px below the top of the page (space-6) and stays at 24px of the viewport.
    expect(index.getBoundingClientRect().top).toBe(24);
    expect(before).toBeGreaterThanOrEqual(24);
    window.scrollTo(0, 0);
  });

  it('PRU-07 AC10 paints the section title in heading-md with its action at the right', async () => {
    await page.viewport(1440, 900);
    renderPage();
    const title = screen.getByRole('heading', { level: 2, name: 'Perfil' });
    const action = screen.getByRole('button', { name: 'Adicionar item' });

    expect(getComputedStyle(title).fontSize).toBe('15px');
    expect(getComputedStyle(title).fontWeight).toBe('600');
    expect(action.getBoundingClientRect().left).toBeGreaterThan(title.getBoundingClientRect().right);
    expect(action.getBoundingClientRect().right).toBe(
      screen.getByRole('region', { name: 'Perfil' }).getBoundingClientRect().right,
    );
  });

  it('PRU-07 AC10 fixes the actions to the bottom of the viewport with a border on top', async () => {
    await page.viewport(1440, 900);
    renderPage(4);
    const actions = screen.getByRole('button', { name: 'Visualizar PDF' }).parentElement!;

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(actions);
      expect(getComputedStyle(actions).borderTopColor, theme).toBe(tokenColor('border'));
      expect(getComputedStyle(actions).backgroundColor, theme).toBe(tokenColor('surface'));
    }
    expect(actions.getBoundingClientRect().bottom).toBe(900);
  });

  it('PRU-07 AC10 stacks index, sections and actions at 360px, with no horizontal scroll', async () => {
    await page.viewport(360, 800);
    renderPage();

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    const index = screen.getByRole('navigation').getBoundingClientRect();
    const section = screen.getByRole('region', { name: 'Perfil' }).getBoundingClientRect();
    expect(section.top).toBeGreaterThanOrEqual(index.bottom);
    expect(section.width).toBe(312);
    await page.viewport(1280, 800);
  });
});
