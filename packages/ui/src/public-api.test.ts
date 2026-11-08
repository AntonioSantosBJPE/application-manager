import { render, screen } from '@testing-library/react';
import { createElement as h } from 'react';
import { describe, expect, it } from 'vitest';
import * as ui from './index';

/**
 * The props and parts that apps/web uses today (read from its screens). Prumo restyles the
 * components and archetypes but must keep all of this working, so the screens compile and their
 * tests keep asserting the same things (PRU-02 AC19, PRU-04 AC15).
 */
describe('public API of the components apps/web uses', () => {
  it('PRU-02 AC19 exports the six components and the four archetypes by name', () => {
    for (const name of [
      'Alert',
      'Button',
      'ConfirmDialog',
      'CopyField',
      'Field',
      'StatusBadge',
      'AppShell',
      'AuthPage',
      'DashboardPage',
      'ListPage',
    ] as const) {
      expect(ui[name], name).toBeDefined();
    }
    expect(Object.keys(ui.Field)).toEqual(
      expect.arrayContaining(['Root', 'Label', 'Control', 'Hint', 'Error']),
    );
  });

  it('PRU-02 AC19 keeps the Button intents, sizes, disabled, type, onClick, className and asChild', () => {
    for (const intent of ['primary', 'secondary', 'ghost', 'danger'] as const) {
      const { unmount } = render(h(ui.Button, { intent }, intent));
      expect(screen.getByRole('button', { name: intent })).toBeInTheDocument();
      unmount();
    }
    render(
      h(
        ui.Button,
        {
          intent: 'secondary',
          size: 'sm',
          disabled: true,
          type: 'submit',
          className: 'shrink-0',
          'aria-label': 'Revogar convite de ana@exemplo.com',
          onClick: () => {},
        },
        'Revogar',
      ),
    );
    const button = screen.getByRole('button', { name: 'Revogar convite de ana@exemplo.com' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('shrink-0');
    render(h(ui.Button, { asChild: true }, h('a', { href: '/' }, 'Voltar')));
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/');
  });

  it('PRU-02 AC19 keeps the Alert intents and their roles', () => {
    render(
      h(
        'div',
        null,
        h(ui.Alert, { intent: 'danger' }, 'Erro'),
        h(ui.Alert, { intent: 'info' }, 'Aviso'),
        h(ui.Alert, { intent: 'warning' }, 'Atenção'),
      ),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Erro');
    expect(screen.getAllByRole('status').map((element) => element.textContent)).toEqual([
      'Aviso',
      'Atenção',
    ]);
  });

  it('PRU-02 AC19 keeps the Field parts and the props of the control', () => {
    render(
      h(
        ui.Field.Root,
        { invalid: true },
        h(ui.Field.Label, { htmlFor: 'email' }, 'E-mail'),
        h(ui.Field.Control, {
          id: 'email',
          type: 'email',
          autoComplete: 'username',
          value: 'ana@exemplo.com',
          onChange: () => {},
          onBlur: () => {},
        }),
        h(ui.Field.Hint, null, 'Dica'),
        h(ui.Field.Error, null, 'Informe um e-mail válido.'),
      ),
    );
    const control = screen.getByLabelText('E-mail');
    expect(control).toHaveAttribute('type', 'email');
    expect(control).toHaveAttribute('autocomplete', 'username');
    expect(control).toHaveValue('ana@exemplo.com');
    expect(control).toBeInvalid();
    expect(control).toHaveAccessibleDescription(/Informe um e-mail válido\./);
    expect(screen.getByText('Dica')).toBeInTheDocument();
  });

  it('PRU-02 AC19 keeps the StatusBadge intents', () => {
    render(
      h(
        'div',
        null,
        h(ui.StatusBadge, { intent: 'operational' }, 'Operacional'),
        h(ui.StatusBadge, { intent: 'unavailable' }, 'Indisponível'),
      ),
    );
    expect(screen.getByText('Operacional')).toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
  });

  it('PRU-02 AC19 keeps the CopyField props', () => {
    render(
      h(ui.CopyField, {
        value: 'https://app.exemplo.dev/invite/abc',
        valueLabel: 'Link do convite',
        copyLabel: 'Copiar',
        copiedLabel: 'Copiado',
        failureMessage: 'Não foi possível copiar.',
        status: 'idle',
        onCopy: () => {},
      }),
    );
    expect(screen.getByLabelText('Link do convite')).toHaveValue('https://app.exemplo.dev/invite/abc');
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
  });

  it('PRU-02 AC19 keeps the ConfirmDialog props and renders its trigger', () => {
    render(
      h(ui.ConfirmDialog, {
        trigger: h(ui.Button, { intent: 'secondary' }, 'Revogar'),
        title: 'Revogar convite',
        description: 'O link deixa de funcionar.',
        confirmLabel: 'Confirmar revogação',
        cancelLabel: 'Cancelar',
        onConfirm: () => {},
      }),
    );
    expect(screen.getByRole('button', { name: 'Revogar' })).toBeInTheDocument();
  });
});

describe('public API of the archetypes apps/web uses', () => {
  it('PRU-04 AC15 keeps the AppShell parts and props', () => {
    render(
      h(
        ui.AppShell.Root,
        null,
        h(
          ui.AppShell.Sidebar,
          { 'aria-label': 'Navegação principal' },
          h(ui.AppShell.NavItem, { current: true, href: '/' }, 'Início'),
          h(ui.AppShell.NavItem, { asChild: true }, h('a', { href: '/admin' }, 'Painel')),
        ),
        h(ui.AppShell.Main, { asChild: true }, h('main', { 'data-archetype': 'list' }, 'Conteúdo')),
      ),
    );
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('href', '/admin');
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('PRU-04 AC15 keeps the AuthPage parts and the form props', () => {
    const { container } = render(
      h(
        ui.AuthPage.Root,
        null,
        h(ui.AuthPage.Header, null, h('h1', null, 'Entrar')),
        h(ui.AuthPage.Form, { noValidate: true, onSubmit: () => {} }, 'Campos'),
      ),
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
  });

  it('PRU-04 AC15 keeps the ListPage parts and the props of Filters and Row', () => {
    // A variable, not a literal: a `data-*` attribute is valid JSX but not an object-literal property.
    const rowProps = { 'data-invitation-id': 'abc', tabIndex: -1, className: 'outline-none' };
    const { container } = render(
      h(
        ui.ListPage.Root,
        null,
        h(ui.ListPage.Header, null, h('h1', null, 'Convites')),
        h(ui.ListPage.Filters, { 'aria-label': 'Convidar pessoa' }, 'Formulário'),
        h(
          ui.ListPage.Content,
          null,
          h(
            'ul',
            null,
            h(
              ui.ListPage.Row,
              rowProps,
              h(ui.ListPage.RowText, null, 'ana@exemplo.com'),
            ),
          ),
        ),
      ),
    );
    expect(screen.getByRole('search', { name: 'Convidar pessoa' })).toBeInTheDocument();
    const row = screen.getByRole('listitem');
    expect(row).toHaveAttribute('data-invitation-id', 'abc');
    expect(row).toHaveAttribute('tabindex', '-1');
    expect(row).toHaveClass('outline-none');
    expect(row).toHaveTextContent('ana@exemplo.com');
    expect(container.querySelector('header')).not.toBeNull();
  });

  it('PRU-04 AC15 keeps the DashboardPage parts', () => {
    const { container } = render(
      h(
        ui.DashboardPage.Root,
        null,
        h(ui.DashboardPage.Header, null, h('h1', null, 'Administração')),
        h(ui.DashboardPage.Grid, null, h('p', null, 'Widget')),
      ),
    );
    expect(screen.getByRole('main')).toHaveAttribute('data-archetype', 'dashboard');
    expect(container.querySelector('header')).not.toBeNull();
    expect(screen.getByText('Widget')).toBeInTheDocument();
  });
});
