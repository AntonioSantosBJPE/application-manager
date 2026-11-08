import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { StatusBadge } from './status-badge';

const meta = {
  title: 'Components/StatusBadge/Neutral',
  component: StatusBadge,
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Privada: Story = {
  args: { children: 'Privada' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Privada').querySelector('svg')).toBeNull();
  },
};

export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { children: 'Privada' },
  globals: { theme: 'light' },
  play: async () => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  },
};

export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { children: 'Privada' },
  globals: { theme: 'dark' },
  play: async () => {
    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  },
};
