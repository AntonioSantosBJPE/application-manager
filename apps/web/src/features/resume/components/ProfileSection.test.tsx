// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fakeResume } from '../testing/fake-api';
import { masterResume, profile } from '../testing/fixtures';
import { renderResumePage } from '../testing/page-harness';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const field = (label: string) => screen.getByLabelText(label);
/** The status region of the topbar, the one that is not the warning of the index. */
const topbarStatus = () => screen.getAllByRole('status').find((node) => node.closest('[class*="border-b"]') !== null)!;

/** Types in a field and leaves it, the gesture of every save of the page. */
function typeAndLeave(label: string, value: string) {
  fireEvent.change(field(label), { target: { value } });
  fireEvent.blur(field(label));
}

const setup = (overrides = {}) => {
  const resume = masterResume({ profile: profile(overrides) });
  const api = fakeResume(server, resume);
  renderResumePage({ resume, section: 'profile' });
  return api;
};

describe('ProfileSection', () => {
  it('RES-43 shows the fields with the labels of the spec, filled with the saved profile', () => {
    setup({
      phone: '+55 11 90000-0000',
      location: 'Recife, PE',
      summary: 'Resumo fictício.',
      links: [{ label: 'Portfólio', url: 'https://exemplo.com/alfa' }],
    });

    expect((field('Nome completo') as HTMLInputElement).value).toBe('Pessoa Fictícia Alfa');
    expect((field('Título profissional') as HTMLInputElement).value).toBe('Título Fictício');
    expect((field('E-mail') as HTMLInputElement).value).toBe('alfa@exemplo.com');
    expect((field('Telefone · opcional') as HTMLInputElement).value).toBe('+55 11 90000-0000');
    expect((field('Local · opcional') as HTMLInputElement).value).toBe('Recife, PE');
    expect((field('Resumo') as HTMLTextAreaElement).value).toBe('Resumo fictício.');
    const link = screen.getByRole('group', { name: 'Link 1' });
    expect((within(link).getByLabelText('Rótulo') as HTMLInputElement).value).toBe('Portfólio');
    expect((within(link).getByLabelText('URL') as HTMLInputElement).value).toBe('https://exemplo.com/alfa');
    expect(screen.getByRole('group', { name: 'Links' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Link' })).toBeEnabled();
  });

  it('RES-44 saves the profile when a changed field is left and shows "Salvo às HH:MM"', async () => {
    const api = setup();
    expect(topbarStatus().textContent).toBe('');

    typeAndLeave('Nome completo', 'Pessoa Fictícia Beta');

    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às \d{2}:\d{2}$/));
    expect(api.calls).toEqual(['PUT /resume/profile']);
    expect(api.bodies).toEqual([{ ...profile(), fullName: 'Pessoa Fictícia Beta' }]);
    expect(api.state.resume.profile.fullName).toBe('Pessoa Fictícia Beta');
    expect((field('Nome completo') as HTMLInputElement).value).toBe('Pessoa Fictícia Beta');
  });

  it('RES-44 saves the text trimmed, and an emptied optional field as no value', async () => {
    const api = setup({ phone: '+55 11 90000-0000' });

    typeAndLeave('Título profissional', '  Título Novo  ');
    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(api.bodies[0]).toMatchObject({ headline: 'Título Novo' });
    expect((field('Título profissional') as HTMLInputElement).value).toBe('Título Novo');

    typeAndLeave('Telefone · opcional', '');
    await waitFor(() => expect(api.calls).toHaveLength(2));
    expect(api.bodies[1]).toMatchObject({ headline: 'Título Novo', phone: null });
  });

  it('RES-44 sends a second field left while the first is saving with the value of the first', async () => {
    const api = setup();
    const release = api.hold('profile');

    typeAndLeave('Nome completo', 'Pessoa Fictícia Beta');
    typeAndLeave('Título profissional', 'Título Novo');
    await waitFor(() => expect(api.calls).toEqual(['PUT /resume/profile']));
    release();

    await waitFor(() => expect(api.calls).toHaveLength(2));
    expect(api.bodies[1]).toEqual({ ...profile(), fullName: 'Pessoa Fictícia Beta', headline: 'Título Novo' });
    await waitFor(() => expect(api.state.resume.profile.headline).toBe('Título Novo'));
  });

  it('RES-45 sends nothing when a field is left with the value it had', async () => {
    const api = setup();

    fireEvent.blur(field('Nome completo'));
    typeAndLeave('Nome completo', 'Pessoa Fictícia Alfa');
    typeAndLeave('Nome completo', '  Pessoa Fictícia Alfa  ');

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.calls).toEqual([]);
    expect(topbarStatus().textContent).toBe('');
  });

  it('RES-46 adds a row with "Rótulo" and "URL" that is saved when both are filled and one is left', async () => {
    const api = setup();

    fireEvent.click(screen.getByRole('button', { name: '+ Link' }));
    const row = screen.getByRole('group', { name: 'Link 1' });
    expect(within(row).getByLabelText('Rótulo')).toHaveFocus();
    fireEvent.change(within(row).getByLabelText('Rótulo'), { target: { value: 'Portfólio' } });
    fireEvent.blur(within(row).getByLabelText('Rótulo'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(api.calls).toEqual([]);

    fireEvent.change(within(row).getByLabelText('URL'), { target: { value: 'https://exemplo.com/alfa' } });
    fireEvent.blur(within(row).getByLabelText('URL'));

    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às/));
    expect(api.bodies).toEqual([{ ...profile(), links: [{ label: 'Portfólio', url: 'https://exemplo.com/alfa' }] }]);
  });

  it('RES-46 removes a link with the "×" of its row and saves the profile without it', async () => {
    const api = setup({
      links: [
        { label: 'Portfólio', url: 'https://exemplo.com/alfa' },
        { label: 'Código', url: 'https://exemplo.com/beta' },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remover link 1' }));

    await waitFor(() => expect(api.calls).toEqual(['PUT /resume/profile']));
    expect(api.bodies[0]).toMatchObject({ links: [{ label: 'Código', url: 'https://exemplo.com/beta' }] });
    expect(screen.getAllByRole('group', { name: /^Link \d$/ })).toHaveLength(1);
    expect((screen.getByLabelText('Rótulo') as HTMLInputElement).value).toBe('Código');
  });

  it('RES-46 drops a row that was never filled without sending anything', async () => {
    const api = setup();
    fireEvent.click(screen.getByRole('button', { name: '+ Link' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remover link 1' }));

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByRole('group', { name: 'Link 1' })).toBeNull();
    expect(api.calls).toEqual([]);
  });

  it('RES-47 shows the e-mail error in the field and sends nothing for an e-mail out of the format', async () => {
    const api = setup();

    typeAndLeave('E-mail', 'nao-e-um-email');

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(field('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(api.calls).toEqual([]);
  });

  it('RES-47 shows the link error for a URL that is not http or https, and sends nothing', async () => {
    const api = setup({ links: [{ label: 'Portfólio', url: 'https://exemplo.com/alfa' }] });
    const row = screen.getByRole('group', { name: 'Link 1' });

    fireEvent.change(within(row).getByLabelText('URL'), { target: { value: 'ftp://exemplo.com/alfa' } });
    fireEvent.blur(within(row).getByLabelText('URL'));

    expect(await screen.findByText('Use um link que comece com http:// ou https://.')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('RES-47 clears the error once the value is valid and saved', async () => {
    const api = setup();
    typeAndLeave('E-mail', 'nao-e-um-email');
    await screen.findByText('Informe um e-mail válido.');

    typeAndLeave('E-mail', 'beta@exemplo.com');

    await waitFor(() => expect(api.calls).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('Informe um e-mail válido.')).toBeNull());
    expect(field('E-mail')).not.toHaveAttribute('aria-invalid');
  });

  it.each([
    ['Nome completo', 121, 'Use no máximo 120 caracteres.'],
    ['Título profissional', 161, 'Use no máximo 160 caracteres.'],
    ['Resumo', 2001, 'Use no máximo 2000 caracteres.'],
  ])('RES-85 shows the limit of %s when the text pasted passes it, and sends nothing', async (label, length, message) => {
    const api = setup();

    typeAndLeave(label, 'a'.repeat(length));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect((field(label) as HTMLInputElement).value).toBe('a'.repeat(length));
    expect(api.calls).toEqual([]);
  });

  it('RES-48 keeps the value and says it could not save when the api fails, and leaving again tries again', async () => {
    const api = setup();
    api.fail('profile', { status: 500 });

    typeAndLeave('Nome completo', 'Pessoa Fictícia Beta');

    expect(await screen.findByText('Não foi possível salvar. Tente de novo.')).toBeInTheDocument();
    expect((field('Nome completo') as HTMLInputElement).value).toBe('Pessoa Fictícia Beta');
    expect(topbarStatus().textContent).toBe('');

    fireEvent.blur(field('Nome completo'));

    await waitFor(() => expect(topbarStatus().textContent).toMatch(/^Salvo às/));
    expect(api.calls).toHaveLength(2);
    expect(screen.queryByText('Não foi possível salvar. Tente de novo.')).toBeNull();
  });

  it('RES-48 shows the pt-BR phrase, not the English detail, when the api refuses the value', async () => {
    const api = setup();
    api.fail('profile', { status: 400, detail: 'Invalid request body' });

    typeAndLeave('Título profissional', 'Título Novo');

    expect(await screen.findByText('Não foi possível salvar. Tente de novo.')).toBeInTheDocument();
    expect(screen.queryByText('Invalid request body')).toBeNull();
    expect((field('Título profissional') as HTMLInputElement).value).toBe('Título Novo');
  });

  it('RES-48 shows the failure of a link under the links and keeps the row', async () => {
    const api = setup();
    api.fail('profile', 'network');
    fireEvent.click(screen.getByRole('button', { name: '+ Link' }));
    const row = screen.getByRole('group', { name: 'Link 1' });
    fireEvent.change(within(row).getByLabelText('Rótulo'), { target: { value: 'Portfólio' } });
    fireEvent.change(within(row).getByLabelText('URL'), { target: { value: 'https://exemplo.com/alfa' } });

    fireEvent.blur(within(row).getByLabelText('URL'));

    expect(await screen.findByText('Não foi possível salvar. Tente de novo.')).toBeInTheDocument();
    expect((within(row).getByLabelText('URL') as HTMLInputElement).value).toBe('https://exemplo.com/alfa');
    expect(topbarStatus().textContent).toBe('');
  });

  it('RES-84 disables "+ Link" at five links, and a fifth row added brings it there', () => {
    setup({ links: [1, 2, 3, 4].map((n) => ({ label: `Link ${n}`, url: `https://exemplo.com/${n}` })) });
    const add = screen.getByRole('button', { name: '+ Link' });
    expect(add).toBeEnabled();

    fireEvent.click(add);

    expect(screen.getAllByRole('group', { name: /^Link \d$/ })).toHaveLength(5);
    expect(add).toBeDisabled();
  });
});
