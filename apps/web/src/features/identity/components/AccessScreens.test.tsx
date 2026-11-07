// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoAccessScreen, UnavailableScreen } from './AccessScreens';

const user = {
  id: '0190a5b4-7c3a-7c8e-9f2a-000000000001',
  email: 'maria@example.test',
  name: 'Maria Membro',
  role: 'member' as const,
};

describe('NoAccessScreen', () => {
  it('says the member has no access and links to the home', () => {
    render(<NoAccessScreen />);

    expect(screen.getByRole('main')).toHaveTextContent('Você não tem acesso a esta área.');
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
  it('says the service is unavailable without offering the login', () => {
    render(<UnavailableScreen />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('offers Tentar novamente, which runs the retry', () => {
    const onRetry = vi.fn();
    render(<UnavailableScreen onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
