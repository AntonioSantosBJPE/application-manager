import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { expectContrast } from '../../testing/contrast';
import { SkillTag } from './skill-tag';

const meta = {
  title: 'Components/SkillTag',
  component: SkillTag,
} satisfies Meta<typeof SkillTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Obrigatoria: Story = {
  name: 'Obrigatória',
  args: { variant: 'required', children: 'TypeScript' },
};

export const Desejavel: Story = {
  name: 'Desejável',
  args: { variant: 'nice', children: 'Kubernetes' },
};

export const Privada: Story = {
  name: 'Privada',
  args: { variant: 'private', children: 'Drizzle ORM' },
};

export const NoCurriculo: Story = {
  name: 'No currículo',
  args: { variant: 'match', children: 'React' },
};

export const Removivel: Story = {
  name: 'Removível',
  args: { variant: 'required', children: 'Terraform', onRemove: fn(), removeLabel: 'Remover Terraform' },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Remover Terraform' }));
    await expect(args.onRemove).toHaveBeenCalledTimes(1);
  },
};

/** Every variant, with and without the remove button, over `surface` and `surface-raised`. */
const todas = () => (
  <div className="flex flex-col gap-3">
    {(['bg-surface', 'bg-surface-raised'] as const).map((surface) => (
      <div key={surface} className={`flex flex-wrap gap-1 p-4 ${surface}`}>
        <SkillTag variant="required">TypeScript</SkillTag>
        <SkillTag variant="nice">Kubernetes</SkillTag>
        <SkillTag variant="private">Drizzle ORM</SkillTag>
        <SkillTag variant="match">React</SkillTag>
        <SkillTag variant="required" onRemove={() => {}} removeLabel="Remover Terraform">
          Terraform
        </SkillTag>
        <SkillTag variant="match" onRemove={() => {}} removeLabel="Remover Node.js">
          Node.js
        </SkillTag>
      </div>
    ))}
  </div>
);

/** The name at 4.5:1 and the remove icon at 3:1 over what is painted behind each tag. */
const contrast: Story['play'] = async ({ canvasElement }) => {
  const tags = [...canvasElement.querySelectorAll<HTMLElement>('[class*="h-5.5"]')];
  await expect(tags).toHaveLength(12);
  for (const tag of tags) {
    await expectContrast(tag, 4.5);
    const remove = tag.querySelector('button');
    if (remove !== null) await expectContrast(remove, 3);
  }
};

export const ContrasteClaro: Story = {
  name: 'PRU-08 AC03 Contraste, tema claro',
  args: { variant: 'required', children: 'TypeScript' },
  globals: { theme: 'light' },
  render: todas,
  play: contrast,
};

export const ContrasteEscuro: Story = {
  name: 'PRU-08 AC03 Contraste, tema escuro',
  args: { variant: 'required', children: 'TypeScript' },
  globals: { theme: 'dark' },
  render: todas,
  play: contrast,
};
