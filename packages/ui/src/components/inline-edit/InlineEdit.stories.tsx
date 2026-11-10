import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';
import { expectContrast, focusRing } from '../../testing/contrast';
import { InlineEdit } from './inline-edit';

function Controlled({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-3">
      {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
        <div key={surface} className={`w-80 p-4 ${surface}`}>
          <InlineEdit
            value={value}
            label={`Editar local em ${surface}`}
            emptyText="Sem local"
            onCommit={setValue}
          />
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Components/InlineEdit',
  component: InlineEdit,
  args: { value: 'Recife, PE', label: 'Editar local', onCommit: () => {} },
  render: () => <Controlled initial="Recife, PE" />,
} satisfies Meta<typeof InlineEdit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^Editar local em bg-surface / }));
    await userEvent.keyboard('Olinda, PE{Enter}');

    await expect(canvas.getByRole('button', { name: /^Editar local em bg-surface / })).toHaveTextContent(
      'Olinda, PE',
    );
    await expect(canvas.getByRole('button', { name: /^Editar local em bg-surface-raised / })).toBeVisible();
  },
};

export const ValorAbreviado: Story = {
  name: 'Valor abreviado',
  render: () => (
    <div className="w-60 bg-surface p-4">
      <InlineEdit
        value="https://vagas.exemplo.com/vento-seguros/backend-pleno"
        label="Editar link da vaga"
        visibleFrom={(value) => value.match(/^https?:\/\//)?.[0].length ?? 0}
        onCommit={() => {}}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /^Editar link da vaga https:\/\// });
    await expect(button.querySelector('.sr-only + .sr-only, .truncate .sr-only')).toHaveTextContent('https://');
    await expect(button).toHaveTextContent('vagas.exemplo.com/vento-seguros/backend-pleno');
  },
};

export const Vazio: Story = {
  name: 'Sem valor',
  render: () => <Controlled initial="" />,
  play: async ({ canvas }) => {
    for (const button of canvas.getAllByRole('button')) await expect(button).toHaveTextContent('Sem local');
  },
};

export const VariasLinhas: Story = {
  name: 'Várias linhas',
  render: () => {
    function Frase() {
      const [value, setValue] = useState(
        'Reduziu o tempo de resposta da API de pedidos em 40% ao trocar consultas repetidas por um cache.',
      );
      return (
        <div className="w-80 bg-surface p-4 text-body-lg">
          <InlineEdit multiline value={value} label="Editar texto" onCommit={setValue} />
        </div>
      );
    }
    return <Frase />;
  },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: /^Editar texto / });
    const reading = button.getBoundingClientRect().height;
    await expect(reading).toBeGreaterThan(32);

    await userEvent.click(button);
    await userEvent.keyboard('Texto novo{Enter}');

    await expect(canvas.getByRole('button', { name: /^Editar texto / })).toHaveTextContent('Texto novo');
  },
};

/** Reading and editing: the text at 4.5:1 and the focus ring at 3:1, on both surfaces. */
const contrast: Story['play'] = async ({ canvas }) => {
  const buttons = canvas.getAllByRole('button');
  for (const button of buttons) await expectContrast(button, 4.5);
  buttons[0]!.focus();
  const reading = focusRing(buttons[0]!);
  await expect(reading.drawn).toBe(true);
  await expect(reading.isFocusToken).toBe(true);

  await userEvent.keyboard('{Enter}');
  const field = canvas.getByRole('textbox');
  await expectContrast(field, 4.5);
  const editing = focusRing(field);
  await expect(editing.drawn).toBe(true);
  await expect(editing.isFocusToken).toBe(true);
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

export const TextoLongoDemais: Story = {
  name: 'Texto longo demais',
  render: () => (
    <div className="w-80 bg-surface p-4 text-body-lg">
      <InlineEdit
        multiline
        value="Texto salvo"
        label="Editar texto"
        validate={(text) => (text.length > 20 ? 'Use no máximo 20 caracteres.' : null)}
        onCommit={() => {}}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^Editar texto / }));
    await userEvent.keyboard('um texto bem mais comprido que o limite{Enter}');

    await expect(canvas.getByText('Use no máximo 20 caracteres.')).toBeInTheDocument();
    await expect(canvas.getByRole('textbox', { name: 'Editar texto' })).toHaveValue(
      'um texto bem mais comprido que o limite',
    );
  },
};
