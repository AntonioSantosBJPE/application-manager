// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InvalidInvitationScreen, NoAccessScreen, UnavailableScreen } from './AccessScreens';

const user = {
  id: '0190a5b4-7c3a-7c8e-9f2a-000000000001',
  email: 'maria@example.test',
  name: 'Maria Membro',
  role: 'member' as const,
};

describe('NoAccessScreen', () => {
  it('PRU-06 AC10 shows the Sem acesso screen: title, message, a primary way home and Sair', () => {
    const signOut = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    render(<NoAccessScreen session={{ user, signOut, onSignedOut: vi.fn() }} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sem acesso');
    expect(
      screen.getByText('Esta área é da administração. Sua conta é de uso do produto.'),
    ).toBeInTheDocument();
    const home = screen.getByRole('link', { name: 'Voltar para o início' });
    expect(home).toHaveAttribute('href', '/');
    expect(home).toHaveClass('bg-accent');
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('keeps the person here and says why when Sair fails', async () => {
    const signOut = vi.fn(() => Promise.resolve({ ok: false as const, status: 503 }));
    const onSignedOut = vi.fn();
    render(<NoAccessScreen session={{ user, signOut, onSignedOut }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
  });

  it('says the member has no access and links to the home', () => {
    render(<NoAccessScreen />);

    expect(screen.getByRole('main')).toHaveTextContent(
      'Esta área é da administração. Sua conta é de uso do produto.',
    );
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
  });

  it('offers Sair when there is a session, and hands over once it ends', async () => {
    const signOut = vi.fn(() => Promise.resolve({ ok: true as const, data: undefined }));
    const onSignedOut = vi.fn();
    render(<NoAccessScreen session={{ user, signOut, onSignedOut }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('UnavailableScreen', () => {
  it('PRU-06 AC11 shows the Indisponível screen with the message and Tentar novamente', () => {
    render(<UnavailableScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Indisponível');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('says the service is unavailable without offering the login', () => {
    render(<UnavailableScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('offers Tentar novamente, which runs the retry', () => {
    const onRetry = vi.fn();
    render(<UnavailableScreen onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('reloads the route when no retry is given', () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
    try {
      render(<UnavailableScreen />);
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });
});

describe('InvalidInvitationScreen', () => {
  it('PRU-06 AC09 shows Convite inválido with the message and no form', () => {
    render(<InvalidInvitationScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Convite inválido');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este convite expirou ou já foi usado. Peça um novo link a quem te convidou.',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
