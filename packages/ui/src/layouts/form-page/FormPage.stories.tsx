import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect, userEvent } from 'storybook/test';
import { Button } from '../../components/button';
import { Field } from '../../components/field';
import { expectContrast } from '../../testing/contrast';
import { AppShell } from '../app-shell';
import { FormPage } from './form-page';

const meta = {
  title: 'Layouts/FormPage',
  component: FormPage.Root,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FormPage.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A long form as the Prumo draws it: an index, sections in a reading column and the actions. */
function Curriculo() {
  return (
    <FormPage.Root>
      <FormPage.Index aria-label="Seções do currículo">
        <AppShell.NavItem href="#perfil" current onClick={(event) => event.preventDefault()}>
          Perfil
        </AppShell.NavItem>
        <AppShell.NavItem href="#experiencia" onClick={(event) => event.preventDefault()}>
          Experiência
        </AppShell.NavItem>
        <AppShell.NavItem href="#formacao" onClick={(event) => event.preventDefault()}>
          Formação
        </AppShell.NavItem>
      </FormPage.Index>
      <FormPage.Content>
        <FormPage.Section id="perfil" title="Perfil">
          <Field.Root>
            <Field.Label htmlFor="form-nome">Nome completo</Field.Label>
            <Field.Control id="form-nome" defaultValue="Marina Alves" />
          </Field.Root>
          <Field.Root>
            <Field.Label htmlFor="form-titulo">Título</Field.Label>
            <Field.Control id="form-titulo" defaultValue="Desenvolvedora Full Stack" />
          </Field.Root>
        </FormPage.Section>
        <FormPage.Section
          id="experiencia"
          title="Experiência"
          actions={
            <Button intent="secondary" size="sm">
              Adicionar item
            </Button>
          }
        >
          <p className="text-text-muted">Nenhuma experiência cadastrada.</p>
        </FormPage.Section>
        <FormPage.Section id="formacao" title="Formação">
          <p className="text-text-muted">Nenhuma formação cadastrada.</p>
        </FormPage.Section>
      </FormPage.Content>
      <FormPage.Actions>
        <span className="mr-auto text-caption text-text-muted">Salvo automaticamente às 14:32</span>
        <Button intent="secondary">Visualizar PDF</Button>
      </FormPage.Actions>
    </FormPage.Root>
  );
}

export const Padrao: Story = {
  name: 'Padrão',
  render: () => <Curriculo />,
  play: async ({ canvas }) => {
    await userEvent.clear(canvas.getByLabelText('Nome completo'));
    await userEvent.type(canvas.getByLabelText('Nome completo'), 'Ana Souza');
    await expect(canvas.getByLabelText('Nome completo')).toHaveValue('Ana Souza');
    await expect(canvas.getAllByRole('region')).toHaveLength(3);
  },
};

/** At 360 px index, sections and actions stack and nothing scrolls sideways (PRU-07 AC10). */
export const Estreito: Story = {
  name: 'PRU-07 AC10 Estreito, 360 px',
  render: () => <Curriculo />,
  play: async () => {
    await page.viewport(360, 800);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    await page.viewport(1280, 800);
  },
};

/** Section titles, the index, the field label and the save note at 4.5:1 over what is behind them. */
const contrast: Story['play'] = async ({ canvas }) => {
  for (const title of canvas.getAllByRole('heading', { level: 2 })) await expectContrast(title, 4.5);
  for (const link of canvas.getAllByRole('link')) await expectContrast(link, 4.5);
  await expectContrast(canvas.getByText('Nome completo'), 4.5);
  await expectContrast(canvas.getByText('Salvo automaticamente às 14:32'), 4.5);
  await expectContrast(canvas.getByText('Nenhuma formação cadastrada.'), 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <Curriculo />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Curriculo />,
  play: contrast,
};
