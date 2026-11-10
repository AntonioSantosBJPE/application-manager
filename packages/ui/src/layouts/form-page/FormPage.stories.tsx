import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect, userEvent } from 'storybook/test';
import { Button } from '../../components/button';
import { Sortable } from '../../components/sortable';
import { SkillTag } from '../../components/skill-tag';
import { Alert } from '../../components/alert';
import { Field } from '../../components/field';
import { expectContrast } from '../../testing/contrast';
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
        <FormPage.IndexLink href="#perfil" current onClick={(event) => event.preventDefault()}>
          Perfil
        </FormPage.IndexLink>
        <FormPage.IndexLink href="#experiencia" count={2} onClick={(event) => event.preventDefault()}>
          Experiência
        </FormPage.IndexLink>
        <FormPage.IndexLink href="#formacao" count={0} onClick={(event) => event.preventDefault()}>
          Formação
        </FormPage.IndexLink>
        <Alert intent="warning" className="mt-3">
          1 bullet sem skill não entra na ordenação por relevância.
        </Alert>
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
          <Sortable.List
            aria-label="Experiências"
            ids={['a', 'b']}
            onReorder={() => {}}
            instructions="Espaço pega, setas movem, Espaço solta."
            announcements={{
              onPick: ({ position }) => `Pegou, posição ${position}.`,
              onMove: ({ position }) => `Posição ${position}.`,
              onDrop: ({ position }) => `Soltou, posição ${position}.`,
              onCancel: ({ position }) => `Cancelou, posição ${position}.`,
            }}
            className="flex flex-col gap-2"
          >
            <Sortable.Item id="a">
              <FormPage.Item aria-label="Desenvolvedora Full Stack">
                <FormPage.ItemHeader
                  handle={<Sortable.Handle label="Mover Desenvolvedora Full Stack" />}
                  actions={
                    <Button intent="ghost" size="sm" aria-label="Editar Desenvolvedora Full Stack">
                      Editar
                    </Button>
                  }
                >
                  <span className="text-body-strong">Desenvolvedora Full Stack · Empresa Exemplo</span>
                  <span className="text-caption text-text-muted">
                    <span className="font-mono">mar 2023 — atual</span> · Remoto
                  </span>
                </FormPage.ItemHeader>
                <FormPage.ItemBody>
                  <SkillTag variant="required">NestJS</SkillTag>
                </FormPage.ItemBody>
              </FormPage.Item>
            </Sortable.Item>
            <Sortable.Item id="b">
              <FormPage.Item aria-label="Desenvolvedora Back-end">
                <FormPage.ItemHeader handle={<Sortable.Handle label="Mover Desenvolvedora Back-end" />}>
                  <span className="text-body-strong">Desenvolvedora Back-end · Outra Empresa</span>
                  <span className="text-caption text-text-muted">
                    <span className="font-mono">jan 2021 — fev 2023</span> · Recife, PE
                  </span>
                </FormPage.ItemHeader>
              </FormPage.Item>
            </Sortable.Item>
          </Sortable.List>
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
    await expect(canvas.getByRole('link', { name: 'Experiência 2' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Formação' })).toHaveTextContent(/^Formação$/);
    await expect(canvas.getAllByRole('article')).toHaveLength(2);
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
  await expectContrast(canvas.getByText('Desenvolvedora Full Stack · Empresa Exemplo'), 4.5);
  await expectContrast(canvas.getByText('mar 2023 — atual'), 4.5);
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
