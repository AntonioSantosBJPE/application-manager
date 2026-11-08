// @vitest-environment jsdom
import type { InvitationDetails } from '@am/contracts';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { acceptInvitation, loadInvitation } from '../api/server-functions';
import { apiInternalUrl, context, problem } from '../testing/api';
import { AcceptInvitationForm } from './AcceptInvitationForm';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const token = 'token-from-the-link';
const details: InvitationDetails = {
  email: 'novo@example.test',
  expiresAt: '2026-11-13T12:00:00.000Z',
};
const invalidMessage = 'Este convite expirou ou já foi usado. Peça um novo link a quem te convidou.';

/** Opens the page the way the route does: the loader asks the api, then the form gets the answer. */
async function open(onSuccess = vi.fn()) {
  const invitation = await loadInvitation(token, context);
  render(
    <AcceptInvitationForm
      invitation={invitation}
      accept={(input) => acceptInvitation(input, token, context)}
      onSuccess={onSuccess}
    />,
  );
  return { onSuccess };
}

function pending() {
  server.use(http.get(`${apiInternalUrl}/invitations/${token}`, () => HttpResponse.json(details)));
}

function fill(name: string, password: string) {
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: password } });
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

describe('AcceptInvitationForm', () => {
  it('PRU-06 AC07 shows the Criar conta screen: line, read-only e-mail, fields, hint, button and expiry', async () => {
    pending();
    await open();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Criar conta');
    expect(
      screen.getByText('Você recebeu um convite para o Rumo Carreira.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByText('Use de 12 a 128 caracteres.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Criar conta' })).toHaveAttribute('type', 'submit');
    // expiresAt is 2026-11-13T12:00Z, which is the 13th in São Paulo.
    expect(screen.getByText(/O convite vale até/)).toHaveTextContent('O convite vale até 13 nov 2026.');
  });

  it('leaves the expiry line out when expiresAt is not a date', async () => {
    render(
      <AcceptInvitationForm
        invitation={{ ok: true, data: { ...details, expiresAt: 'soon' } }}
        accept={(input) => acceptInvitation(input, token, context)}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument();
    expect(screen.queryByText(/O convite vale até/)).toBeNull();
  });

  it('PRU-03 AC08 offers Mostrar senha on the password, with the same label in both states', async () => {
    pending();
    await open();
    const password = screen.getByLabelText('Senha');

    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));

    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByRole('button', { name: 'Ocultar senha' })).toBeNull();
  });

  it('PRU-03 AC09 keeps the toggle state and the typed value after a failed submit', async () => {
    pending();
    server.use(http.post(`${apiInternalUrl}/invitations/${token}/accept`, () => problem(503)));
    await open();

    fill('Novo Membro', 'a long enough password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    submit();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Senha')).toHaveValue('a long enough password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows the invited email read-only and the password rule', async () => {
    pending();
    await open();

    const email = screen.getByLabelText('E-mail');
    expect(email).toHaveValue('novo@example.test');
    expect(email).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Nome')).toBeEnabled();
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(
      'Use de 12 a 128 caracteres.',
    );
  });

  it('creates the account with the typed name and password and hands over to the route', async () => {
    pending();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${apiInternalUrl}/invitations/${token}/accept`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const { onSuccess } = await open();

    fill('  Novo Membro ', 'a long enough password');
    submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(bodies).toEqual([{ name: 'Novo Membro', password: 'a long enough password' }]);
  });

  it('PRU-06 AC09 opens the Convite inválido screen for an expired, used, revoked or unknown link', async () => {
    server.use(http.get(`${apiInternalUrl}/invitations/${token}`, () => problem(410)));
    await open();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Convite inválido');
    expect(screen.getByRole('alert')).toHaveTextContent(invalidMessage);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the invalid message without a form on 410 at open and at submit', async () => {
    server.use(http.get(`${apiInternalUrl}/invitations/${token}`, () => problem(410)));
    await open();

    expect(screen.getByRole('alert')).toHaveTextContent(invalidMessage);
    expect(screen.queryByLabelText('Nome')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
    cleanup();

    pending();
    server.use(http.post(`${apiInternalUrl}/invitations/${token}/accept`, () => problem(410)));
    const { onSuccess } = await open();
    fill('Novo Membro', 'a long enough password');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(invalidMessage);
    expect(screen.queryByLabelText('Nome')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('says the service is unavailable when the invitation cannot be checked', async () => {
    server.use(http.get(`${apiInternalUrl}/invitations/${token}`, () => problem(503)));
    await open();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'O serviço não respondeu. Seus dados estão seguros; tente de novo em instantes.',
    );
    expect(screen.queryByRole('button', { name: 'Criar conta' })).toBeNull();
  });

  it('says the service is unavailable on submit and keeps the form with what was typed', async () => {
    pending();
    server.use(http.post(`${apiInternalUrl}/invitations/${token}/accept`, () => problem(503)));
    await open();

    fill('Novo Membro', 'a long enough password');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(screen.getByLabelText('Nome')).toHaveValue('Novo Membro');
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled();
  });

  it('PRU-06 AC08 rejects an 11-character password and a blank name before calling the api, keeping the hint', async () => {
    pending();
    let requests = 0;
    server.use(
      http.post(`${apiInternalUrl}/invitations/${token}/accept`, () => {
        requests += 1;
        return new HttpResponse(null, { status: 201 });
      }),
    );
    await open();

    fill('   ', 'a'.repeat(11));
    submit();

    expect(
      await screen.findByText('Informe seu nome, com até 120 caracteres.'),
    ).toBeInTheDocument();
    expect(screen.getByText('A senha precisa ter de 12 a 128 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('Use de 12 a 128 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toBe(0);
  });

  it('disables submit while waiting and sends one request', async () => {
    pending();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    server.use(
      http.post(`${apiInternalUrl}/invitations/${token}/accept`, async () => {
        requests += 1;
        await gate;
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const { onSuccess } = await open();

    fill('Novo Membro', 'a long enough password');
    submit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar conta' })).toBeDisabled());
    submit();
    release();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(requests).toBe(1);
  });
});
