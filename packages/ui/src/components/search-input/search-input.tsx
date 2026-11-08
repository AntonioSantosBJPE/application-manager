import { Search } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Icon } from '../../icons/icon';
import { controlClassName, join } from '../field/field-context';

export type SearchInputProps = Omit<ComponentProps<'input'>, 'type'> & {
  /** Classes of the wrapper that holds the icon and the input, to set its width. */
  wrapperClassName?: string;
};

/**
 * A search field: `input type="search"` with the `search` icon at its left, in the look of the other
 * text controls (`border-control`, focus ring drawn inside). The component knows no copy, so the
 * accessible name comes from the caller: `aria-label`, `aria-labelledby` or a `<label htmlFor>`.
 */
export function SearchInput({ wrapperClassName, className, ...props }: SearchInputProps) {
  return (
    <div className={join('relative flex items-center', wrapperClassName)}>
      <Icon
        icon={Search}
        size="sm"
        className="pointer-events-none absolute left-2 shrink-0 text-text-muted"
      />
      <input
        type="search"
        className={join('h-control-sm pl-7', controlClassName(false, false), className)}
        {...props}
      />
    </div>
  );
}
