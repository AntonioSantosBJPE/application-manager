import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { Button } from '../button';
import { Kbd } from './kbd';

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tecla: Story = {
  name: 'Tecla',
  args: { children: 'K' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('K').tagName).toBe('KBD');
  },
};

/** A chord is a few symbols, a sequence two separate keys. */
function Atalhos() {
  return (
    <div className="flex flex-col gap-3 bg-surface p-4">
      <div className="flex items-center gap-1 text-caption text-text-muted">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
        <span>abrir comandos</span>
      </div>
      <div className="flex items-center gap-1 text-caption text-text-muted">
        <Kbd>G</Kbd>
        <Kbd>C</Kbd>
        <span>ir para candidaturas</span>
      </div>
      <Button intent="primary" className="self-start">
        Nova candidatura <Kbd tone="on-accent">C</Kbd>
      </Button>
    </div>
  );
}

export const Atalho: Story = {
  name: 'Atalhos',
  render: () => <Atalhos />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('C')).toHaveLength(2);
  },
};

/** The key text at 4.5:1 over its fill; inside the primary Button, text and border over the accent. */
const contrast: Story['play'] = async ({ canvas }) => {
  for (const key of canvas.getAllByText(/^[⌘KG]$/)) await expectContrast(key, 4.5);
  const [, primaryKey] = canvas.getAllByText('C');
  await expectContrast(primaryKey!, 4.5);
  await expectContrast(primaryKey!, 3, 'borderTopColor');
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <Atalhos />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Atalhos />,
  play: contrast,
};
