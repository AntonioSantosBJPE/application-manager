// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createInvitation, loadInvitations, revokeInvitation } from '../api/server-functions';
import { apiInternalUrl, context, problem } from '../testing/api';
import { InvitationsPanel } from './InvitationsPanel';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

interface Stored {
  id: string;
  email: string;
  expiresAt?: string;
}

const uuid = (n: number) => `0190a5b4-7c3a-7c8e-9f2a-${String(n).padStart(12, '0')}`;
const inviteUrl = 'http://app.example.test/invite/a-token-shown-once';

/** An api with state: the list the screen reads changes as the screen invites and revokes, like the real one. */
function apiWith(initial: Stored[], pageSize = 20) {
  const pending = [...initial];
  const requests = {
    lists: [] as (string | null)[],
    revoked: [] as string[],
    created: [] as unknown[],
  };
  server.use(
    http.get(`${apiInternalUrl}/invitations`, ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      requests.lists.push(cursor);
      const start = cursor === null ? 0 : pending.findIndex((item) => item.id === cursor) + 1;
      const items = pending.slice(start, start + pageSize);
      const more = start + pageSize < pending.length;
      return HttpResponse.json({
        items: items.map((item) => ({ expiresAt: '2026-11-13T12:00:00.000Z', ...item })),
        nextCursor: more ? items[items.length - 1]!.id : null,
        totalPending: pending.length,
      });
    }),
    http.post(`${apiInternalUrl}/invitations`, async ({ request }) => {
      const body = (await request.json()) as { email: string };
      requests.created.push(body);
      pending.unshift({ id: uuid(900 + pending.length), email: body.email });
      return HttpResponse.json(
        { inviteUrl, expiresAt: '2026-11-13T12:00:00.000Z' },
        { status: 201 },
      );
    }),
    http.delete(`${apiInternalUrl}/invitations/:id`, ({ params }) => {
      requests.revoked.push(String(params.id));
      const index = pending.findIndex((item) => item.id === params.id);
      if (index === -1) return problem(404);
      pending.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return requests;
}

function renderPanel(onExpired: (outcome: unknown) => boolean = () => false, now?: () => Date) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <InvitationsPanel
        onExpired={onExpired}
        now={now}
        api={{
          list: (cursor) => loadInvitations(cursor, context),
          create: (input) => createInvitation(input, context),
          revoke: (id) => revokeInvitation(id, context),
        }}
      />
    </QueryClientProvider>,
  );
}

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

function invite(email: string) {
  fireEvent.change(screen.getByLabelText('E-mail a convidar'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));
}

const list = () => screen.findByRole('list', { name: 'Convites pendentes' });

describe('InvitationsPanel', () => {
  it('shows the link once with copy and adds the email to the list', async () => {
    apiWith([{ id: uuid(1), email: 'antigo@example.test' }]);
    renderPanel();
    await list();

    invite('novo@example.test');

    expect(await screen.findByLabelText('Link do convite')).toHaveValue(inviteUrl);
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'este link só aparece desta vez. Copie-o agora.',
    );
    await waitFor(() =>
      expect(within(screen.getByRole('list')).getByText('novo@example.test')).toBeInTheDocument(),
    );
    expect(within(screen.getByRole('list')).getByText('antigo@example.test')).toBeInTheDocument();
    expect(screen.getByText('2 pendentes')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail a convidar')).toHaveValue('');
  });

  it('disables Convidar while waiting and sends one request', async () => {
    // UI-23: a second submit would create a second invitation, which revokes the link just received.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requests = apiWith([]);
    server.use(
      http.post(`${apiInternalUrl}/invitations`, async ({ request }) => {
        requests.created.push(await request.json());
        await gate;
        return HttpResponse.json(
          { inviteUrl, expiresAt: '2026-11-13T12:00:00.000Z' },
          { status: 201 },
        );
      }),
    );
    renderPanel();
    await screen.findByText('Nenhum convite pendente.');

    invite('novo@example.test');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Convidar' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }));
    fireEvent.submit(screen.getByLabelText('E-mail a convidar').closest('form')!);
    release();

    expect(await screen.findByLabelText('Link do convite')).toHaveValue(inviteUrl);
    expect(requests.created).toHaveLength(1);
  });

  it('copies the link and shows Copiado', async () => {
    apiWith([]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    renderPanel();
    await screen.findByText('Nenhum convite pendente.');
    invite('novo@example.test');
    await screen.findByLabelText('Link do convite');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(inviteUrl);
  });

  it('keeps the link selectable and shows the message when copy fails', async () => {
    apiWith([]);
    stubClipboard(() => Promise.reject(new Error('denied')));
    renderPanel();
    await screen.findByText('Nenhum convite pendente.');
    invite('novo@example.test');
    await screen.findByLabelText('Link do convite');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(
      await screen.findByText('Não foi possível copiar. Selecione o link.'),
    ).toBeInTheDocument();
    const link = screen.getByLabelText('Link do convite');
    expect(link).toHaveValue(inviteUrl);
    expect(link).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Copiado' })).toBeNull();
  });

  it('shows the existing account message and keeps the value', async () => {
    apiWith([]);
    server.use(http.post(`${apiInternalUrl}/invitations`, () => problem(409)));
    renderPanel();
    await screen.findByText('Nenhum convite pendente.');

    invite('quem@example.test');

    expect(await screen.findByText('Este e-mail já tem uma conta.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail a convidar')).toHaveValue('quem@example.test');
    expect(screen.queryByLabelText('Link do convite')).toBeNull();
  });

  it('asks confirmation with the email before revoking', async () => {
    const requests = apiWith([{ id: uuid(1), email: 'a@example.test' }]);
    renderPanel();
    await list();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar convite de a@example.test' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('a@example.test');
    expect(requests.revoked).toEqual([]);
    expect(screen.getByText('a@example.test', { selector: 'li span' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(requests.revoked).toEqual([]);
    expect(screen.getByText('a@example.test')).toBeInTheDocument();
  });

  it('removes the invitation and updates the total after confirming', async () => {
    const requests = apiWith([
      { id: uuid(1), email: 'a@example.test' },
      { id: uuid(2), email: 'b@example.test' },
    ]);
    renderPanel();
    await list();
    expect(screen.getByText('2 pendentes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar convite de a@example.test' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revogar' }),
    );

    await waitFor(() => expect(screen.queryByText('a@example.test')).toBeNull());
    expect(screen.getByText('b@example.test')).toBeInTheDocument();
    expect(await screen.findByText('1 pendente')).toBeInTheDocument();
    expect(requests.revoked).toEqual([uuid(1)]);
  });

  it('moves the focus to the first new row after Carregar mais', async () => {
    apiWith(
      [1, 2, 3].map((n) => ({ id: uuid(n), email: `p${n}@example.test` })),
      2,
    );
    renderPanel();
    await list();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    const row = (await screen.findByText('p3@example.test')).closest('li');
    await waitFor(() => expect(row).toHaveFocus());
  });

  it('moves the focus to the next row after revoking, and to the title after the last one', async () => {
    apiWith([
      { id: uuid(1), email: 'a@example.test' },
      { id: uuid(2), email: 'b@example.test' },
    ]);
    renderPanel();
    await list();

    const revoke = async (email: string) => {
      fireEvent.click(screen.getByRole('button', { name: `Revogar convite de ${email}` }));
      fireEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revogar' }),
      );
      await waitFor(() => expect(screen.queryByText(email)).toBeNull());
    };

    await revoke('a@example.test');
    await waitFor(() => expect(screen.getByText('b@example.test').closest('li')).toHaveFocus());

    await revoke('b@example.test');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Convites', level: 1 })).toHaveFocus(),
    );
    expect(document.body).not.toHaveFocus();
  });

  it('shows the empty message and the form', async () => {
    apiWith([]);
    renderPanel();

    expect(await screen.findByText('Nenhum convite pendente.')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail a convidar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('loads the next page with nextCursor', async () => {
    const requests = apiWith(
      [1, 2, 3].map((n) => ({ id: uuid(n), email: `p${n}@example.test` })),
      2,
    );
    renderPanel();
    await list();
    expect(screen.queryByText('p3@example.test')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('p3@example.test')).toBeInTheDocument();
    expect(screen.getByText('p1@example.test')).toBeInTheDocument();
    expect(requests.lists).toEqual([null, uuid(2)]);
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('asks for a valid email before calling the api', async () => {
    const requests = apiWith([]);
    renderPanel();
    await screen.findByText('Nenhum convite pendente.');

    invite('not-an-email');

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(requests.created).toEqual([]);
  });

  it('hands a 401 from an action to the expired-session redirect', async () => {
    apiWith([{ id: uuid(1), email: 'a@example.test' }]);
    server.use(http.delete(`${apiInternalUrl}/invitations/:id`, () => problem(401)));
    const onExpired = vi.fn().mockReturnValue(true);
    renderPanel(onExpired);
    await list();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar convite de a@example.test' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revogar' }),
    );

    await waitFor(() =>
      expect(onExpired).toHaveBeenCalledWith(expect.objectContaining({ ok: false, status: 401 })),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the service is unavailable when the list cannot be read', async () => {
    server.use(http.get(`${apiInternalUrl}/invitations`, () => problem(503)));
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Serviço indisponível. Tente novamente em instantes.',
    );
    expect(screen.getByLabelText('E-mail a convidar')).toBeInTheDocument();
  });

  describe('as the PageAdminInvitations', () => {
    const now = new Date('2026-11-08T12:00:00.000Z');
    const inDays = (days: number) =>
      new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

    it('PRU-06 AC16 shows the title with the count, the form in the filter row and the group Pendentes', async () => {
      apiWith([
        { id: uuid(1), email: 'a@exemplo.com' },
        { id: uuid(2), email: 'b@exemplo.com' },
      ]);
      renderPanel(undefined, () => now);
      const rows = within(await list()).getAllByRole('listitem');

      const title = screen.getByRole('heading', { level: 1 });
      expect(title.textContent).toBe('Convites');
      const count = screen.getByText('2 pendentes');
      expect(count).toHaveClass('font-mono');
      expect(title.parentElement).toContainElement(count);
      const filters = screen.getByRole('search', { name: 'Convidar pessoa' });
      expect(within(filters).getByLabelText('E-mail a convidar')).toBeInTheDocument();
      expect(within(filters).getByRole('button', { name: 'Convidar' })).toHaveAttribute(
        'type',
        'submit',
      );
      const group = screen.getByRole('heading', { level: 2 });
      expect(group.textContent).toBe('Pendentes2');
      expect(rows.map((row) => within(row).getByText(/@exemplo\.com$/).textContent)).toEqual([
        'a@exemplo.com',
        'b@exemplo.com',
      ]);
    });

    it('PRU-06 AC17 shows the strip with the e-mail, the note and the link above the list', async () => {
      apiWith([{ id: uuid(1), email: 'antigo@exemplo.com' }]);
      renderPanel(undefined, () => now);
      await list();

      invite('novo@exemplo.com');

      const note = await screen.findByRole('status');
      expect(note.textContent).toBe(
        'Convite criado para novo@exemplo.com· este link só aparece desta vez. Copie-o agora.',
      );
      const strip = note.parentElement!;
      expect(strip).toHaveClass('bg-surface-raised');
      const link = within(strip).getByLabelText('Link do convite');
      expect(link).toHaveValue(inviteUrl);
      expect(within(strip).getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
      await waitFor(() =>
        expect(within(screen.getByRole('list')).getByText('novo@exemplo.com')).toBeInTheDocument(),
      );
      expect(
        strip.compareDocumentPosition(screen.getByRole('list')) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('PRU-06 AC18 shows the days left, in warning with 2 days or fewer, and Revogar as ghost', async () => {
      apiWith([
        { id: uuid(1), email: 'longe@exemplo.com', expiresAt: inDays(7) },
        { id: uuid(2), email: 'tres@exemplo.com', expiresAt: inDays(3) },
        { id: uuid(3), email: 'dois@exemplo.com', expiresAt: inDays(2) },
        { id: uuid(4), email: 'horas@exemplo.com', expiresAt: inDays(0.25) },
      ]);
      renderPanel(undefined, () => now);
      await list();

      const expiryOf = (email: string) => {
        const row = screen.getByText(email).closest('li')!;
        return within(row).getByText(/^expira em \d+ d$/);
      };
      expect(expiryOf('longe@exemplo.com').textContent).toBe('expira em 7 d');
      expect(expiryOf('longe@exemplo.com')).not.toHaveClass('text-warning');
      expect(expiryOf('tres@exemplo.com').textContent).toBe('expira em 3 d');
      expect(expiryOf('tres@exemplo.com')).not.toHaveClass('text-warning');
      expect(expiryOf('dois@exemplo.com').textContent).toBe('expira em 2 d');
      expect(expiryOf('dois@exemplo.com')).toHaveClass('text-warning', 'font-mono');
      expect(expiryOf('horas@exemplo.com').textContent).toBe('expira em 1 d');
      expect(expiryOf('horas@exemplo.com')).toHaveClass('text-warning');
      const revoke = screen.getByRole('button', { name: 'Revogar convite de dois@exemplo.com' });
      expect(revoke.textContent).toBe('Revogar');
      expect(revoke).toHaveClass('bg-transparent', 'h-control-sm');
    });

    it('PRU-06 AC19 opens the ConfirmDialog with the e-mail; Esc closes it without revoking and the focus returns', async () => {
      const requests = apiWith([{ id: uuid(1), email: 'a@exemplo.com' }]);
      renderPanel(undefined, () => now);
      await list();
      const trigger = screen.getByRole('button', { name: 'Revogar convite de a@exemplo.com' });

      trigger.focus();
      fireEvent.click(trigger);
      const dialog = await screen.findByRole('alertdialog', { name: 'Revogar convite' });
      expect(dialog).toHaveTextContent('O link enviado para a@exemplo.com deixa de funcionar.');
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
      expect(requests.revoked).toEqual([]);
      await waitFor(() => expect(trigger).toHaveFocus());

      fireEvent.click(trigger);
      fireEvent.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revogar' }),
      );
      await waitFor(() => expect(requests.revoked).toEqual([uuid(1)]));
    });

    it('PRU-06 AC24 shows the EmptyState with the sentence and the action that leads to the e-mail field', async () => {
      apiWith([]);
      renderPanel(undefined, () => now);

      const sentence = await screen.findByText('Nenhum convite pendente.');
      const empty = sentence.parentElement!;
      expect(empty).toHaveClass('border-dashed');
      expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
      const action = within(empty).getByRole('button', { name: 'Convidar pessoa' });

      fireEvent.click(action);

      expect(screen.getByLabelText('E-mail a convidar')).toHaveFocus();
    });

    it('PRU-06 AC25 shows Alert danger when the list fails and keeps the title and the form', async () => {
      server.use(http.get(`${apiInternalUrl}/invitations`, () => problem(503)));
      renderPanel(undefined, () => now);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Serviço indisponível. Tente novamente em instantes.');
      expect(screen.getByRole('heading', { level: 1, name: 'Convites' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Convidar' })).toBeEnabled();
      expect(screen.queryByText('Nenhum convite pendente.')).toBeNull();
    });
  });
});
