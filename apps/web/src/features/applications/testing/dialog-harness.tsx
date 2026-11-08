import type { ApplicationDetail, ApplicationStatus } from '@am/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { postApplication } from '../api/server-functions';
import { ApplicationFormDialog, type ApplicationFormValues } from '../components/ApplicationFormDialog';
import { context } from './api';
import { fakeSkillsApi } from './skills-api';

/** The dialog over the fake api: the create call goes through the real BFF function to MSW. */
export function renderDialog(
  options: { status?: ApplicationStatus; initial?: Partial<ApplicationFormValues>; onExpired?: (outcome: unknown) => boolean } = {},
) {
  const skills = fakeSkillsApi();
  const onClose = vi.fn();
  const onSaved = vi.fn<(application: ApplicationDetail) => void>();
  const onExpired = vi.fn(options.onExpired ?? (() => false));
  render(
    <ApplicationFormDialog
      status={options.status}
      initial={options.initial}
      onClose={onClose}
      onSaved={onSaved}
      onExpired={onExpired}
      api={{
        create: (body) => postApplication(body, context),
        skills: { search: skills.search, create: skills.create },
      }}
    />,
  );
  return { skills, onClose, onSaved, onExpired };
}

export const dialog = () => screen.getByRole('dialog', { name: 'Nova candidatura' });

/** The member types: one change event with the whole text. */
export const typeInto = (field: HTMLElement, text: string) => fireEvent.change(field, { target: { value: text } });

/** Picks a skill from the suggestions of a skills field by typing part of its name. */
export async function pickSkill(field: string, typed: string, optionName: string | RegExp) {
  typeInto(screen.getByRole('combobox', { name: field }), typed);
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
}

/** Fills the three required fields of the form. */
export function fillRequired(company = 'Empresa Fictícia Alfa', title = 'Vaga de Teste Pleno', level = 'Pleno') {
  typeInto(screen.getByLabelText('Empresa'), company);
  typeInto(screen.getByLabelText('Título'), title);
  fireEvent.click(screen.getByRole('radio', { name: level }));
}
