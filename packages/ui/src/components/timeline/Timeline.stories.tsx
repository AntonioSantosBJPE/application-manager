import type { Meta, StoryObj } from '@storybook/react-vite';
import { MessageSquare, UserRound } from 'lucide-react';
import { expect, within } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { Timeline } from './timeline';

const events = () => (
  <div className="flex flex-col gap-3">
    {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
      <div key={surface} className={`w-96 p-4 ${surface}`}>
        <Timeline.Root aria-label={`Histórico em ${surface}`}>
          <Timeline.Item icon={MessageSquare} date="20 out">
            <Timeline.Emphasis>Nota</Timeline.Emphasis> · recrutadora disse que retorna em duas semanas
          </Timeline.Item>
          <Timeline.Item icon={UserRound} date="18 out">
            Etapa <Timeline.Emphasis>RH</Timeline.Emphasis> concluída
          </Timeline.Item>
          <Timeline.Item icon={MessageSquare} date="14 out">
            Vaga cadastrada
          </Timeline.Item>
        </Timeline.Root>
      </div>
    ))}
  </div>
);

const meta = {
  title: 'Components/Timeline',
  component: Timeline.Root,
  render: events,
} satisfies Meta<typeof Timeline.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    const [list] = canvas.getAllByRole('list');
    await expect(within(list!).getAllByRole('listitem')).toHaveLength(3);
  },
};

/** The text and the date at 4.5:1 on both surfaces. */
const contrast: Story['play'] = async ({ canvas }) => {
  for (const item of canvas.getAllByRole('listitem')) {
    for (const part of item.querySelectorAll<HTMLElement>(':scope > span:not([aria-hidden])')) {
      await expectContrast(part, 4.5);
    }
  }
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  play: contrast,
};
