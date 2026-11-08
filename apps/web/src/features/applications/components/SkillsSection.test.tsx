// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { renderDetail } from '../testing/detail-harness';
import { pickSkill } from '../testing/dialog-harness';
import { fakeDetail } from '../testing/fake-detail';
import { detail, postingSkill, uuid } from '../testing/fixtures';
import { nest, react, skillNames } from '../testing/skills-api';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const java = { ...postingSkill(1, 'required', 'Java'), category: 'language' as const };
const spring = { ...postingSkill(2, 'required', 'Spring Boot'), category: 'framework' as const };
const kube = { ...postingSkill(3, 'nice_to_have', 'Kubernetes'), category: 'tool' as const };
const opened = (skills = [java, spring, kube]) => detail(1, { skills });
const names = (label: 'Obrigatórias' | 'Desejáveis') =>
  within(screen.getByRole('list', { name: label }))
    .queryAllByRole('listitem')
    .map((item) => item.textContent);
const put = (...entries: [string, 'required' | 'nice_to_have'][]) =>
  `PUT /applications/${opened().id}/skills ${JSON.stringify(entries.map(([skillId, requirement]) => ({ skillId, requirement })))}`;

describe('SkillsSection', () => {
  it('APP-73 removes a skill with its "×": the whole remaining list is written, required first, and the tag is gone', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(screen.getByRole('button', { name: 'Remover Java' }));

    await waitFor(() => expect(names('Obrigatórias')).toEqual(['Spring Boot']));
    expect(names('Desejáveis')).toEqual(['Kubernetes']);
    expect(api.callsTo('PUT', '/skills')).toEqual([put([spring.id, 'required'], [kube.id, 'nice_to_have'])]);
  });

  it('APP-73 adds a skill to the nice to have row with "+ Skill" and the same selector as the dialog, at the end of the list', async () => {
    const api = fakeDetail(server, opened(), { skillNames });
    renderDetail(opened());

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar skill desejável' }));
    await pickSkill('Adicionar skill desejável', 'react', /^React/);

    await waitFor(() => expect(names('Desejáveis')).toEqual(['Kubernetes', 'React']));
    expect(names('Obrigatórias')).toEqual(['Java', 'Spring Boot']);
    expect(api.callsTo('PUT', '/skills')).toEqual([
      put([java.id, 'required'], [spring.id, 'required'], [kube.id, 'nice_to_have'], [react.id, 'nice_to_have']),
    ]);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('APP-73 adds a skill to the required row with the "+ Skill" of that row', async () => {
    const api = fakeDetail(server, opened(), { skillNames });
    renderDetail(opened());

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar skill obrigatória' }));
    await pickSkill('Adicionar skill obrigatória', 'nest', /^NestJS/);

    await waitFor(() => expect(names('Obrigatórias')).toEqual(['Java', 'Spring Boot', 'NestJS']));
    expect(api.callsTo('PUT', '/skills')).toEqual([
      put([java.id, 'required'], [spring.id, 'required'], [nest.id, 'required'], [kube.id, 'nice_to_have']),
    ]);
  });

  it('APP-73 moves a skill that is in the other row instead of repeating it', async () => {
    const inReact = { id: react.id, name: 'React', scope: 'global' as const, requirement: 'nice_to_have' as const, category: 'framework' as const };
    const api = fakeDetail(server, opened([java, inReact]), { skillNames });
    renderDetail(opened([java, inReact]));

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar skill obrigatória' }));
    await pickSkill('Adicionar skill obrigatória', 'react', /^React/);

    await waitFor(() => expect(names('Obrigatórias')).toEqual(['Java', 'React']));
    expect(names('Desejáveis')).toEqual([]);
    expect(api.callsTo('PUT', '/skills')).toEqual([put([java.id, 'required'], [react.id, 'required'])]);
  });

  it('APP-73 closes the selector with Esc or Cancelar and writes nothing', async () => {
    const api = fakeDetail(server, opened());
    renderDetail(opened());

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar skill desejável' }));
    const field = screen.getByRole('combobox', { name: 'Adicionar skill desejável' });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(screen.queryByRole('combobox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar skill obrigatória' }));
    expect(screen.getByRole('combobox', { name: 'Adicionar skill obrigatória' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('combobox')).toBeNull();

    expect(api.calls).toEqual([]);
  });

  it('APP-73 keeps the tags and shows a danger Alert when the list is refused', async () => {
    const api = fakeDetail(server, opened());
    api.fail('skills', 500);
    renderDetail(opened());

    fireEvent.click(screen.getByRole('button', { name: 'Remover Java' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível. Tente novamente em instantes.');
    expect(names('Obrigatórias')).toEqual(['Java', 'Spring Boot']);
  });

  it('APP-73 marks a private skill as private and keeps it when another skill is removed', async () => {
    const mine = { id: uuid(901), name: 'Skill Fictícia Privada', scope: 'private' as const, requirement: 'required' as const, category: 'tool' as const };
    const api = fakeDetail(server, opened([java, mine]));
    renderDetail(opened([java, mine]));

    expect(names('Obrigatórias')).toEqual(['Java', 'Skill Fictícia Privada·']);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Java' }));

    await waitFor(() => expect(names('Obrigatórias')).toEqual(['Skill Fictícia Privada·']));
    expect(api.callsTo('PUT', '/skills')).toEqual([put([mine.id, 'required'])]);
  });
});
