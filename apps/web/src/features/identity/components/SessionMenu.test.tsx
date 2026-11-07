// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { logout } from '../api/server-functions';
import { apiInternalUrl, context, problem } from '../testing/api';
import { SessionMenu } from './SessionMenu';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const user = {
  id: '0190a5b4-7c3a-7c8e-9f2a-1b2c3d4e5f60',
  email: 'ana@example.test',
  name: 'Ana Souza',
  role: 'member' as const,
};

function renderMenu(onSignedOut = vi.fn()) {
  render(<SessionMenu user={user} signOut={() => logout(context)} onSignedOut={onSignedOut} />);
  return { onSignedOut };
}

describe('SessionMenu', () => {
  it('shows the name of the user and the Sair action', () => {
    renderMenu();

    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
  });

  it('ends the session on the api and hands over to the route', async () => {
    let requests = 0;
    server.use(
      http.post(`${apiInternalUrl}/auth/logout`, () => {
        requests += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onSignedOut } = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(onSignedOut).toHaveBeenCalledTimes(1));
    expect(requests).toBe(1);
  });

  it('says the service is unavailable and stays signed in when the api is down', async () => {
    server.use(http.post(`${apiInternalUrl}/auth/logout`, () => problem(503)));
    const { onSignedOut } = renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
  });
});
