import type { LucideIcon } from 'lucide-react';

const pixels = { default: 16, sm: 14 } as const;

export interface IconProps {
  /** A Lucide icon, imported by name (`import { Eye } from 'lucide-react'`) so only it is bundled. */
  icon: LucideIcon;
  /** 16px by default, 14px with `sm`. */
  size?: keyof typeof pixels;
  className?: string;
}

/**
 * The one way packages/ui draws an icon (PRU-01): stroke 1.75, 16px or 14px, in the color of the
 * surrounding text. Icons go with text, so the svg is hidden from assistive technology.
 */
export function Icon({ icon: Glyph, size = 'default', className }: IconProps) {
  return (
    <Glyph
      size={pixels[size]}
      strokeWidth={1.75}
      color="currentColor"
      aria-hidden="true"
      className={className}
    />
  );
}
