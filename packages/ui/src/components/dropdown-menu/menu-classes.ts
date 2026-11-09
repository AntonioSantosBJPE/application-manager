/*
 * The look of a floating menu, shared by the `DropdownMenu` and the `ContextMenu` so the two never drift apart.
 */

export const contentClassName =
  'z-10 flex min-w-50 flex-col rounded-md border border-border-strong bg-surface-overlay p-1 text-text shadow-overlay';

export const itemClassName = [
  'flex h-7.5 cursor-pointer items-center gap-2 rounded-sm px-2 text-body text-text outline-focus',
  'data-highlighted:bg-surface-hover data-highlighted:outline-2 data-highlighted:-outline-offset-2',
  'data-disabled:cursor-not-allowed data-disabled:opacity-50',
].join(' ');
