import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { PipelineStatus, type PipelineStatusValue } from './pipeline-status';

const meta = {
  title: 'Components/PipelineStatus',
  component: PipelineStatus,
} satisfies Meta<typeof PipelineStatus>;

export default meta;
type Story = StoryObj<typeof meta>;

const statuses: [PipelineStatusValue, string][] = [
  ['saved', 'Salva'],
  ['applied', 'Enviada'],
  ['interviewing', 'Em entrevistas'],
  ['offer', 'Proposta'],
  ['accepted', 'Aceita'],
  ['rejected', 'Recusada'],
  ['withdrawn', 'Desisti'],
  ['ghosted', 'Sem retorno'],
];

export const Padrao: Story = {
  name: 'Padrão',
  args: { status: 'applied', label: 'Enviada' },
};

export const SoIcone: Story = {
  name: 'Só o ícone',
  args: { status: 'interviewing', label: 'Em entrevistas', iconOnly: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img', { name: 'Em entrevistas' })).toBeVisible();
  },
};

/** The eight statuses with label and, below, icon only, over `surface` and `surface-raised`. */
const todos = () => (
  <div className="flex flex-col gap-3">
    {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
      <div key={surface} className={`flex flex-col gap-3 p-4 ${surface}`}>
        <div className="flex flex-wrap gap-5">
          {statuses.map(([status, label]) => (
            <PipelineStatus key={status} status={status} label={label} />
          ))}
        </div>
        <div className="flex gap-2">
          {statuses.map(([status, label]) => (
            <PipelineStatus key={status} status={status} label={label} iconOnly />
          ))}
        </div>
      </div>
    ))}
  </div>
);

/** Icons at 3:1 and labels at 4.5:1 against the surface they sit on, for every status. */
const contrast: Story['play'] = async ({ canvasElement }) => {
  const icons = [...canvasElement.querySelectorAll<SVGElement>('[data-status-icon]')];
  await expect(icons).toHaveLength(32);
  for (const icon of icons) await expectContrast(icon, 3);
  for (const [, label] of statuses) {
    for (const text of [...canvasElement.querySelectorAll('span > span')].filter(
      (node) => node.textContent === label,
    )) {
      await expectContrast(text, 4.5);
    }
  }
};

export const TodosOsStatusClaro: Story = {
  name: 'PRU-08 AC03 Contraste dos oito status, tema claro',
  args: { status: 'saved', label: 'Salva' },
  globals: { theme: 'light' },
  render: todos,
  play: contrast,
};

export const TodosOsStatusEscuro: Story = {
  name: 'PRU-08 AC03 Contraste dos oito status, tema escuro',
  args: { status: 'saved', label: 'Salva' },
  globals: { theme: 'dark' },
  render: todos,
  play: contrast,
};
