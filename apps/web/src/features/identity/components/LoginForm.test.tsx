// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loginMember } from '../api/server-functions';
import { apiInternalUrl, context, problem } from '../testing/api';
import { LoginForm } from './LoginForm';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderForm(overrides: { onSuccess?: () => void; notice?: string } = {}) {
  const onSuccess = overrides.onSuccess ?? vi.fn();
  render(
    <LoginForm
      title="Entrar"
      login={(input) => loginMember(input, context)}
      onSuccess={onSuccess}
      notice={overrides.notice}
    />,
  );
  return { onSuccess };
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginForm', () => {
  it('sends the typed credentials and hands over to the route on 204', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${apiInternalUrl}/auth/login`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onSuccess } = renderForm();

    fill(' Ana@Example.com ', 'correct horse battery');
    submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([{ email: 'ana@example.com', password: 'correct horse battery' }]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the 401 message and keeps the email', async () => {
    server.use(http.post(`${apiInternalUrl}/auth/login`, () => problem(401)));
    const { onSuccess } = renderForm();

    fill('ana@example.com', 'wrong password!!');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows the 429 message with minutes rounded up', async () => {
    server.use(http.post(`${apiInternalUrl}/auth/login`, () => problem(429, 61)));
    renderForm();

    fill('ana@example.com', 'whatever password');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Tente novamente em 2 min.',
    );
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com');
  });

  it('shows the unavailable message on 503 without leaving the screen', async () => {
    server.use(http.post(`${apiInternalUrl}/auth/login`, () => problem(503)));
    const { onSuccess } = renderForm();

    fill('ana@example.com', 'whatever password');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@example.com');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows the unavailable message when the api does not answer at all', async () => {
    server.use(http.post(`${apiInternalUrl}/auth/login`, () => HttpResponse.error()));
    renderForm();

    fill('ana@example.com', 'whatever password');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
  });

  it('disables submit while waiting and sends one request', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    server.use(
      http.post(`${apiInternalUrl}/auth/login`, async () => {
        requests += 1;
        await gate;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onSuccess } = renderForm();

    fill('ana@example.com', 'correct horse battery');
    submit();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled());
    submit();
    submit();
    release();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(requests).toBe(1);
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  it('asks for a valid email and a password before calling the api', async () => {
    let requests = 0;
    server.use(
      http.post(`${apiInternalUrl}/auth/login`, () => {
        requests += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderForm();

    fill('not-an-email', '');
    submit();

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveValue('not-an-email');
    expect(requests).toBe(0);
  });

  it('shows the notice above the fields', () => {
    renderForm({ notice: 'Sua sessão expirou. Entre novamente.' });

    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão expirou. Entre novamente.');
  });
});
