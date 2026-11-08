import type { Meta, StoryObj } from '@storybook/react-vite';
import { page } from '@vitest/browser/context';
import { expect } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { Alert } from '../../components/alert';
import { PipelineStatus } from '../../components/pipeline-status';
import { DetailPage } from './detail-page';

const meta = {
  title: 'Layouts/DetailPage',
  component: DetailPage.Root,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DetailPage.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One application as the Prumo draws it: the content at the left and the properties at the right. */
function Vaga() {
  return (
    <DetailPage.Root>
      <DetailPage.Main>
        <div className="flex flex-col gap-1">
          <span className="text-caption text-text-muted">Acme Pagamentos</span>
          <h1 className="text-heading-lg">Desenvolvedor Backend Pleno</h1>
        </div>
        <Alert intent="warning">Sem retorno há 21 dias.</Alert>
        <section className="flex flex-col gap-3">
          <h2 className="text-heading-sm">Descrição</h2>
          <p className="text-text-muted">Conteúdo do item: descrição, skills, linha do tempo.</p>
        </section>
      </DetailPage.Main>
      <DetailPage.Sidebar aria-label="Propriedades">
        <DetailPage.Properties>
          <DetailPage.Property name="Status">
            <PipelineStatus status="interviewing" label="Em entrevistas" />
          </DetailPage.Property>
          <DetailPage.Property name="Nível">Pleno</DetailPage.Property>
          <DetailPage.Property name="Modelo">Remoto</DetailPage.Property>
          <DetailPage.Property name="Atividade">
            <span className="font-mono text-text-muted">06 nov 2026</span>
          </DetailPage.Property>
        </DetailPage.Properties>
      </DetailPage.Sidebar>
    </DetailPage.Root>
  );
}

export const Padrao: Story = {
  name: 'Padrão',
  render: () => <Vaga />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('complementary', { name: 'Propriedades' })).toBeVisible();
    await expect(canvas.getAllByRole('term')).toHaveLength(4);
  },
};

/** At 360 px the properties go under the content and nothing scrolls sideways (PRU-07 AC09). */
export const Estreito: Story = {
  name: 'PRU-07 AC09 Estreito, 360 px',
  render: () => <Vaga />,
  play: async ({ canvas }) => {
    await page.viewport(360, 800);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    await expect(
      canvas.getByRole('complementary').getBoundingClientRect().top,
    ).toBeGreaterThanOrEqual(canvas.getByRole('heading', { level: 1 }).getBoundingClientRect().bottom);
    await page.viewport(1280, 800);
  },
};

/** Title, section title, property names and values at 4.5:1 over what is painted behind them. */
const contrast: Story['play'] = async ({ canvas }) => {
  await expectContrast(canvas.getByRole('heading', { level: 1 }), 4.5);
  await expectContrast(canvas.getByRole('heading', { level: 2 }), 4.5);
  for (const term of canvas.getAllByRole('term')) await expectContrast(term, 4.5);
  for (const value of canvas.getAllByRole('definition')) await expectContrast(value, 4.5);
  await expectContrast(canvas.getByText('06 nov 2026'), 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <Vaga />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Vaga />,
  play: contrast,
};
