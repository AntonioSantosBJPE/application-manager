import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { backgroundBehind, contrastRatio, settle } from '../../testing/contrast';
import { Logo, type LogoTone } from './logo';

const meta = {
  title: 'Components/Logo',
  component: Logo,
  args: { variant: 'wordmark' },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Simbolo: Story = {
  name: 'Símbolo',
  args: { variant: 'mark' },
};

export const Logotipo: Story = {
  name: 'Logotipo',
  args: { variant: 'wordmark' },
};

export const Rotulado: Story = {
  name: 'Logotipo com nome acessível',
  args: { variant: 'wordmark', title: 'Rumo Carreira' },
};

/** Every allowed color on its allowed background (the Logo card and assets/logos/README.md). */
const allowed: { surface: string; className: string; tone: LogoTone }[] = [
  { surface: 'surface', className: 'bg-surface', tone: 'accent' },
  { surface: 'surface', className: 'bg-surface', tone: 'text' },
  { surface: 'surface-raised', className: 'bg-surface-raised', tone: 'accent' },
  { surface: 'surface-raised', className: 'bg-surface-raised', tone: 'text' },
  { surface: 'bloco accent', className: 'bg-accent', tone: 'surface' },
];

const everyColor: Story['render'] = () => (
  <div className="flex flex-col gap-2">
    {allowed.map(({ surface, className, tone }) => (
      <div
        key={`${surface}-${tone}`}
        data-logo-sample={`${surface} / ${tone}`}
        className={`flex items-center gap-6 rounded-md p-4 ${className}`}
      >
        <Logo variant="mark" tone={tone} size={24} />
        <Logo variant="wordmark" tone={tone} size={24} />
      </div>
    ))}
  </div>
);

/**
 * Each sample paints the ring at 3:1 or more and the words at 4.5:1 or more against its own
 * background, in the colors the tone names (PRU-08 AC06, PRU-05 AC04).
 */
const everyColorPlay: Story['play'] = async ({ canvasElement }) => {
  const samples = [...canvasElement.querySelectorAll<HTMLElement>('[data-logo-sample]')];
  await expect(samples).toHaveLength(allowed.length);
  for (const sample of samples) {
    await settle(sample);
    const name = sample.dataset.logoSample;
    const behind = backgroundBehind(sample);
    for (const circle of sample.querySelectorAll('circle')) {
      await expect(
        contrastRatio(getComputedStyle(circle).stroke, behind),
        `${name}: ring`,
      ).toBeGreaterThanOrEqual(3);
    }
    for (const word of sample.querySelectorAll('svg + span > span')) {
      await expect(
        contrastRatio(getComputedStyle(word).color, behind),
        `${name}: ${word.textContent}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  }
};

export const CoresClaro: Story = {
  name: 'PRU-08 AC06 Logo nas cores permitidas, tema claro',
  globals: { theme: 'light' },
  render: everyColor,
  play: everyColorPlay,
};

export const CoresEscuro: Story = {
  name: 'PRU-08 AC06 Logo nas cores permitidas, tema escuro',
  globals: { theme: 'dark' },
  render: everyColor,
  play: everyColorPlay,
};
