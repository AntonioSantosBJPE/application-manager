import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { Button } from '../button';
import { Kbd } from '../kbd';
import { EmptyState } from './empty-state';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState.Root,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EmptyState.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const withAction = (
  <EmptyState.Root className="max-w-form">
    <p>Nenhuma candidatura ainda. Cadastre a primeira vaga para começar o pipeline.</p>
    <EmptyState.Action>
      <Button>
        Nova candidatura <Kbd tone="on-accent">C</Kbd>
      </Button>
    </EmptyState.Action>
  </EmptyState.Root>
);

export const ComAcao: Story = {
  name: 'Com ação',
  render: () => withAction,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Nova candidatura/ })).toBeVisible();
  },
};

export const SoFrase: Story = {
  name: 'Só a frase',
  render: () => (
    <EmptyState.Root className="max-w-form">
      <p>Quando houver candidaturas, aqui aparecem o pipeline e a atividade recente.</p>
    </EmptyState.Root>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

/** The sentence at 4.5:1 over `surface`; the dashed border is decoration, the sentence says it all. */
const contrast: Story['play'] = async ({ canvas }) => {
  await expectContrast(canvas.getByText(/Nenhuma candidatura ainda/), 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => withAction,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => withAction,
  play: contrast,
};
