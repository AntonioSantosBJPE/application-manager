import { cva } from 'class-variance-authority';
import { Check, Plus, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../../icons/icon';

const skillTagVariants = cva(
  'inline-flex h-5.5 items-center gap-1 rounded-sm border px-2 text-caption whitespace-nowrap',
  {
    variants: {
      variant: {
        required: 'border-border-strong bg-surface text-text',
        nice: 'border-dashed border-border-strong bg-surface text-text-muted',
        private: 'border-border-strong bg-surface text-text',
        match: 'border-transparent bg-accent-subtle text-accent-text',
      },
    },
  },
);

export type SkillTagVariant = 'required' | 'nice' | 'private' | 'match';

type Removable =
  | { onRemove?: undefined; removeLabel?: undefined }
  | {
      /** Shows a remove button; it is called once per activation. */
      onRemove: () => void;
      /** The accessible name of the remove button, from the caller ("Remover Node.js"). */
      removeLabel: string;
    };

export type SkillTagProps = Omit<ComponentProps<'span'>, 'children'> & {
  /**
   * `required` (the default look), `nice` (dashed, muted), `private` (made by the person, not yet in
   * the catalog: ends with a "·") or `match` (the resume covers it: accent fill and a check).
   */
  variant: SkillTagVariant;
  /** The official name of the skill. */
  children: string;
} & Removable;

/**
 * A skill of the catalog (PRU-07), 22px tall, in `caption`. The name comes from the caller, always
 * the official one ("Node.js"), and so does the label of the optional remove button.
 */
export function SkillTag({
  variant,
  children,
  onRemove,
  removeLabel,
  className,
  ...props
}: SkillTagProps) {
  return (
    <span className={skillTagVariants({ variant, className })} {...props}>
      {variant === 'match' ? <Icon icon={Check} size="sm" /> : null}
      {children}
      {variant === 'private' ? <span aria-hidden="true">·</span> : null}
      {onRemove === undefined ? null : (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className={[
            '-mr-1 inline-flex size-4.5 items-center justify-center rounded-sm',
            variant === 'match' ? 'text-accent-text' : 'text-text-muted hover:text-text',
          ].join(' ')}
        >
          <Icon icon={X} size="sm" />
        </button>
      )}
    </span>
  );
}

export type SkillTagAddProps = Omit<ComponentProps<'button'>, 'type'>;

/**
 * "Adicionar": the dashed chip that ends a row of skill tags ("+ Skill"). It has the size and the shape
 * of a tag, with the border dashed and the text muted, and it is a button, so the caller names it with
 * its text and, when the text is not enough, with `aria-label`.
 */
export function SkillTagAdd({ children, className, ...props }: SkillTagAddProps) {
  return (
    <button
      type="button"
      className={[
        'inline-flex h-5.5 items-center gap-1 rounded-sm border border-dashed border-border-strong bg-surface px-2 text-caption whitespace-nowrap text-text-muted',
        'transition-colors duration-150 hover:bg-surface-hover hover:text-text',
        'outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <Icon icon={Plus} size="sm" />
      {children}
    </button>
  );
}
