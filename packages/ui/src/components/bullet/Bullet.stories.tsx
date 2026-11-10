import type { Meta, StoryObj } from '@storybook/react-vite';
import { Ellipsis } from 'lucide-react';
import { expect } from 'storybook/test';
import { Icon } from '../../icons/icon';
import { expectContrast } from '../../testing/contrast';
import { Button } from '../button';
import { SkillTag } from '../skill-tag';
import { Bullet } from './bullet';

const meta = {
  title: 'Components/Bullet',
  component: Bullet.Root,
} satisfies Meta<typeof Bullet.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

const grip = <span className="text-text-muted">⋮⋮</span>;

const menu = (
  <Bullet.Actions>
    <Button intent="ghost" size="sm" aria-label="Mais ações">
      <Icon icon={Ellipsis} size="sm" />
    </Button>
  </Bullet.Actions>
);

/** Both surfaces, with tags and without. */
function Exemplos() {
  return (
    <div className="flex flex-col gap-3">
      {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
        <div key={surface} className={`flex w-160 max-w-full flex-col gap-0.5 p-4 text-text ${surface}`}>
          <Bullet.Root handle={grip} aside={menu}>
            <Bullet.Text>
              Construí a API de pagamentos recorrentes em NestJS e PostgreSQL, processando 40 mil cobranças por
              mês.
            </Bullet.Text>
            <Bullet.Tags>
              <SkillTag variant="required">NestJS</SkillTag>
              <SkillTag variant="required">PostgreSQL</SkillTag>
              <SkillTag variant="private">Drizzle ORM</SkillTag>
            </Bullet.Tags>
          </Bullet.Root>
          <Bullet.Root handle={grip} aside={<Bullet.Notice>sem skill</Bullet.Notice>}>
            <Bullet.Text>Conduzi a adoção de testes de contrato entre três times.</Bullet.Text>
            <Bullet.Tags />
          </Bullet.Root>
        </div>
      ))}
    </div>
  );
}

export const ComTags: Story = {
  name: 'Com tags',
  render: () => <Exemplos />,
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('NestJS')).toHaveLength(2);
    await expect(canvas.getAllByText('sem skill')).toHaveLength(2);
  },
};

export const SemTags: Story = {
  name: 'Sem tags',
  render: () => (
    <div className="w-160 max-w-full bg-surface p-4 text-text">
      <Bullet.Root handle={grip} aside={<Bullet.Notice>sem skill</Bullet.Notice>}>
        <Bullet.Text>Conduzi a adoção de testes de contrato entre três times.</Bullet.Text>
        <Bullet.Tags />
      </Bullet.Root>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('sem skill')).toBeVisible();
  },
};

/** The sentence at 4.5:1 and the warning notice at 4.5:1 over what is behind them. */
const contrast: Story['play'] = async ({ canvas }) => {
  for (const text of canvas.getAllByText(/^Conduzi|^Construí/)) await expectContrast(text, 4.5);
  for (const notice of canvas.getAllByText('sem skill')) await expectContrast(notice, 4.5);
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  globals: { theme: 'light' },
  render: () => <Exemplos />,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  globals: { theme: 'dark' },
  render: () => <Exemplos />,
  play: contrast,
};
