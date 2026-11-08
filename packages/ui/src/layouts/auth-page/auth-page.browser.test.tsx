import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { Alert } from '../../components/alert';
import { Button } from '../../components/button';
import { Field } from '../../components/field';
import { settle } from '../../testing/contrast';
import { AuthPage } from './auth-page';

/** A token color as the browser resolves it, to compare with a computed style. */
function tokenColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(--color-${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

function renderPage() {
  return render(
    <AuthPage.Root>
      <AuthPage.Header>
        <h1 className="text-heading-xl">Entrar</h1>
        <p className="text-text-muted">Rumo Carreira — suas candidaturas e currículos</p>
      </AuthPage.Header>
      <Alert intent="info">Sua sessão expirou. Entre de novo para continuar.</Alert>
      <AuthPage.Form>
        <Field.Root>
          <Field.Label htmlFor="e">E-mail</Field.Label>
          <Field.Control id="e" type="email" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="p">Senha</Field.Label>
          <Field.Control id="p" type="password" />
        </Field.Root>
        <Button type="submit">Entrar</Button>
      </AuthPage.Form>
      <AuthPage.Footer>O acesso é por convite.</AuthPage.Footer>
    </AuthPage.Root>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

describe('AuthPage in the browser', () => {
  it('PRU-04 AC07 paints a main on surface with a 360px column a little above the center, with no card', async () => {
    await page.viewport(1280, 800);
    const { container } = renderPage();
    const main = screen.getByRole('main');
    const column = main.firstElementChild as HTMLElement;

    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(main);
      expect(getComputedStyle(main).backgroundColor, theme).toBe(tokenColor('surface'));
    }
    const box = column.getBoundingClientRect();
    expect(box.width).toBe(360);
    expect(box.left + box.width / 2).toBe(640);
    // Above the vertical center of the viewport, but not stuck to the top.
    const center = box.top + box.height / 2;
    expect(center).toBeLessThan(400);
    expect(box.top).toBeGreaterThan(24);
    const style = getComputedStyle(column);
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.borderTopWidth).toBe('0px');
    expect(style.boxShadow).toBe('none');
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('PRU-04 AC08 draws the 20px mark above the title, the form fields 16px apart and a full-width button', async () => {
    await page.viewport(1280, 800);
    const { container } = renderPage();
    const mark = container.querySelector('header svg')!.getBoundingClientRect();
    const title = screen.getByRole('heading', { name: 'Entrar' });
    const form = container.querySelector('form')!;
    const fields = [...form.querySelectorAll('input')].map((input) => input.closest('div')!);
    const button = screen.getByRole('button', { name: 'Entrar' });

    expect(mark.width).toBe(20);
    expect(mark.height).toBe(20);
    expect(mark.bottom).toBeLessThanOrEqual(title.getBoundingClientRect().top);
    expect(getComputedStyle(title).fontSize).toBe('24px');
    expect(fields[1]!.getBoundingClientRect().top - fields[0]!.getBoundingClientRect().bottom).toBe(16);
    expect(button.getBoundingClientRect().top - fields[1]!.getBoundingClientRect().bottom).toBe(16);
    expect(button.getBoundingClientRect().width).toBe(form.getBoundingClientRect().width);
  });

  it('PRU-04 AC08 puts the alert between the header and the first field, and the footer under a border rule', async () => {
    await page.viewport(1280, 800);
    const { container } = renderPage();
    const header = container.querySelector('header')!.getBoundingClientRect();
    const alert = screen.getByRole('status').getBoundingClientRect();
    const firstField = screen.getByLabelText('E-mail').getBoundingClientRect();
    const footer = container.querySelector('footer')!;

    expect(alert.top).toBeGreaterThanOrEqual(header.bottom);
    expect(alert.bottom).toBeLessThanOrEqual(firstField.top);
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      await settle(footer);
      const style = getComputedStyle(footer);
      expect(style.borderTopWidth).toBe('1px');
      expect(style.borderTopColor, theme).toBe(tokenColor('border'));
      expect(style.color, theme).toBe(tokenColor('text-muted'));
      expect(style.fontSize).toBe('12px');
    }
  });

  it('PRU-04 AC07 fits a 360px screen with no horizontal scroll', async () => {
    await page.viewport(360, 800);
    renderPage();
    const column = screen.getByRole('main').firstElementChild as HTMLElement;

    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    expect(column.getBoundingClientRect().width).toBe(312);
    expect(screen.getByRole('button', { name: 'Entrar' }).getBoundingClientRect().right).toBeLessThanOrEqual(360);
    await page.viewport(1280, 800);
  });
});
