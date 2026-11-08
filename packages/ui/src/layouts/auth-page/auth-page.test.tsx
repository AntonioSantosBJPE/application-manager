import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthPage } from './auth-page';

function renderPage() {
  return render(
    <AuthPage.Root>
      <AuthPage.Header>
        <h1>Entrar</h1>
        <p>Use o e-mail do convite.</p>
      </AuthPage.Header>
      <AuthPage.Form>
        <label htmlFor="email">E-mail</label>
        <input id="email" />
        <button type="submit">Entrar</button>
      </AuthPage.Form>
      <AuthPage.Footer>
        <a href="/invite/token">Tenho um convite</a>
      </AuthPage.Footer>
    </AuthPage.Root>,
  );
}

describe('AuthPage', () => {
  it('renders the header, the form and the footer inside the main landmark', () => {
    const { container } = renderPage();

    const main = screen.getByRole('main');
    const header = container.querySelector('header');
    const footer = container.querySelector('footer');
    expect(header).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(main).toContainElement(header);
    expect(main).toContainElement(footer);
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Entrar' }));
    expect(main).toContainElement(screen.getByLabelText('E-mail'));
    expect(main).toContainElement(screen.getByRole('link', { name: 'Tenho um convite' }));
  });

  it('marks the archetype so the screens can be told apart', () => {
    renderPage();

    expect(screen.getByRole('main')).toHaveAttribute('data-archetype', 'auth');
  });

  it('renders a form element that submits what the caller composed', () => {
    let submitted = 0;
    const { container } = render(
      <AuthPage.Root>
        <AuthPage.Form onSubmit={(event) => {
          event.preventDefault();
          submitted += 1;
        }}>
          <label htmlFor="name">Nome</label>
          <input id="name" />
          <button type="submit">Criar conta</button>
        </AuthPage.Form>
      </AuthPage.Root>,
    );

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Criar conta' }));

    expect(container.querySelector('form')).not.toBeNull();
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana');
    expect(submitted).toBe(1);
  });

  it('uses only token classes, with no raw palette color or arbitrary value', () => {
    const { container } = renderPage();

    const classes = [container, ...container.querySelectorAll('*')]
      .flatMap((element) => [...element.classList])
      .filter(Boolean);
    expect(classes.length).toBeGreaterThan(0);
    for (const name of classes) {
      expect(name).not.toMatch(/\[.*\]/);
      expect(name).not.toMatch(
        /(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d|-(black|white)$/,
      );
    }
  });
});

describe('AuthPage parts', () => {
  it('PRU-04 AC07 is a main with the column inside it, and no card around the content', () => {
    const { container } = renderPage();

    const main = screen.getByRole('main');
    expect(main).toHaveClass('bg-surface');
    expect(main.firstElementChild).toHaveClass('max-w-auth');
    expect(main.firstElementChild).toContainElement(container.querySelector('form'));
    for (const element of [main, ...main.querySelectorAll('*')]) {
      expect(element).not.toHaveClass('shadow-overlay', 'bg-surface-raised', 'bg-surface-overlay');
    }
  });

  it('PRU-04 AC08 opens the header with the mark and keeps the title and the line the caller wrote', () => {
    const { container } = renderPage();

    const header = container.querySelector('header')!;
    const mark = header.querySelector('svg')!;
    expect(mark).toHaveAttribute('width', '20');
    expect(mark).toHaveAttribute('height', '20');
    expect(header.firstElementChild).toContainElement(mark);
    expect(header).toContainElement(screen.getByRole('heading', { name: 'Entrar' }));
    expect(header).toHaveTextContent('Use o e-mail do convite.');
  });

  it('PRU-05 AC07 shows the mark, not the wordmark, in the header', () => {
    const { container } = renderPage();

    const header = container.querySelector('header')!;
    expect(header.querySelector('svg')).not.toBeNull();
    expect(header).not.toHaveTextContent('rumo');
    expect(header).not.toHaveTextContent('carreira');
  });

  it('PRU-04 AC08 keeps an alert between the header and the first field', () => {
    render(
      <AuthPage.Root>
        <AuthPage.Header>
          <h1>Entrar</h1>
        </AuthPage.Header>
        <div role="alert">E-mail ou senha incorretos.</div>
        <AuthPage.Form>
          <label htmlFor="email">E-mail</label>
          <input id="email" />
        </AuthPage.Form>
      </AuthPage.Root>,
    );

    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const alert = screen.getByRole('alert');
    expect(follows(screen.getByRole('heading', { name: 'Entrar' }), alert)).toBe(true);
    expect(follows(alert, screen.getByLabelText('E-mail'))).toBe(true);
  });

  it('PRU-04 AC08 sets the form gap to space-4 and the footer note in caption, text-muted, under a rule', () => {
    const { container } = renderPage();

    expect(container.querySelector('form')).toHaveClass('gap-4');
    const footer = container.querySelector('footer')!;
    expect(footer).toHaveClass('border-t', 'border-border', 'text-caption', 'text-text-muted');
  });
});
