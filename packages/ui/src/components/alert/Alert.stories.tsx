import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { expectContrast, settle } from '../../testing/contrast';
import { Button } from '../button';
import { Alert } from './alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Perigo: Story = {
  name: 'Perigo',
  args: { intent: 'danger', children: 'E-mail ou senha incorretos.' },
};

export const Informacao: Story = {
  name: 'Informação',
  args: { intent: 'info', children: 'Este link aparece uma única vez.' },
};

export const Aviso: Story = {
  name: 'Aviso',
  args: { intent: 'warning', children: 'Sem atividade há 21 dias.' },
};

const onMark = fn();

/** A warning with its action at the right end; the click reaches the caller (PRU-02 AC08). */
export const ComAcao: Story = {
  name: 'PRU-02 AC08 Aviso com ação',
  args: {
    intent: 'warning',
    children: 'Sem atividade há 21 dias.',
    action: (
      <Button intent="secondary" size="sm" onClick={onMark}>
        Marcar sem retorno
      </Button>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 480 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    onMark.mockClear();
    await userEvent.click(canvas.getByRole('button', { name: 'Marcar sem retorno' }));
    await expect(onMark).toHaveBeenCalledTimes(1);
  },
};

/** A CSS color as the browser resolves it, to compare with a computed style. */
function resolvedColor(color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved;
}

/** Light theme through the toolbar global; asserts the light danger token reaches the message. */
export const TemaClaro: Story = {
  name: 'Tema claro',
  args: { intent: 'danger', children: 'E-mail ou senha incorretos.' },
  globals: { theme: 'light' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    // The light value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.52 0.17 27)'));
  },
};

/** Dark theme through the toolbar global; asserts the dark danger token reaches the message. */
export const TemaEscuro: Story = {
  name: 'Tema escuro',
  args: { intent: 'danger', children: 'E-mail ou senha incorretos.' },
  globals: { theme: 'dark' },
  play: async ({ canvas }) => {
    const alert = canvas.getByRole('alert');

    await expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    // The dark value of --color-danger in tokens.css.
    await expect(getComputedStyle(alert).color).toBe(resolvedColor('oklch(0.72 0.15 25)'));
  },
};

const threeIntents: Story['render'] = () => (
  <div className="flex w-96 flex-col gap-3 bg-surface p-4">
    <Alert intent="danger">E-mail ou senha incorretos.</Alert>
    <Alert intent="info">Sua sessão expirou. Entre de novo para continuar.</Alert>
    <Alert intent="warning">Sem atividade há 21 dias.</Alert>
  </div>
);

/** The message reaches 4.5:1 on its fill and the icon 3:1, for every intent (PRU-08 AC03). */
const contrast: Story['play'] = async ({ canvasElement }) => {
  const alerts = [...canvasElement.querySelectorAll('[role="alert"], [role="status"]')];
  await expect(alerts).toHaveLength(3);
  for (const alert of alerts) {
    await settle(alert);
    const message = alert.children[1]!;
    const icon = alert.querySelector('svg')!;
    await expectContrast(message, 4.5);
    await expectContrast(icon, 3);
  }
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  args: { intent: 'info' },
  globals: { theme: 'light' },
  render: threeIntents,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  args: { intent: 'info' },
  globals: { theme: 'dark' },
  render: threeIntents,
  play: contrast,
};
