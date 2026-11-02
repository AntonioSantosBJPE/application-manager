import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { StatusBadge } from './status-badge';

const meta = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Operacional: Story = {
  args: { intent: 'operational', children: 'Operacional' },
};

export const Indisponivel: Story = {
  name: 'Indisponível',
  args: { intent: 'unavailable', children: 'Indisponível' },
};

/** Dark theme through the toolbar global; asserts the dark token reaches the rendered badge. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { intent: 'operational', children: 'Operacional' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const badge = canvas.getByText('Operacional');
    // The dark value of --color-status-operational in tokens.css, resolved by the browser.
    const expected = document.createElement('span');
    expected.style.color = 'oklch(0.78 0.14 150)';
    document.body.append(expected);
    const darkColor = getComputedStyle(expected).color;
    expected.remove();

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    await expect(getComputedStyle(badge).color).toBe(darkColor);
  },
};
