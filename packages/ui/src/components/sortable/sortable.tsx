import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { type ComponentProps, createContext, useContext, useId, useRef } from 'react';
import { Icon } from '../../icons/icon';

function join(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Where an item is while it is moved: its id and its place, counted from 1, among `total` items. */
export interface SortableAnnouncement {
  id: string;
  position: number;
  total: number;
}

/**
 * What the live region says at each step of a move. The design system ships no product copy, so the
 * caller writes every sentence (and the id is there for it to find the name of the item).
 */
export interface SortableAnnouncements {
  /** The item was picked up, at its place. */
  onPick: (announcement: SortableAnnouncement) => string;
  /** The picked item is now over this place. */
  onMove: (announcement: SortableAnnouncement) => string;
  /** The item was dropped at this place. */
  onDrop: (announcement: SortableAnnouncement) => string;
  /** The move was cancelled and the item is back at its place. */
  onCancel: (announcement: SortableAnnouncement) => string;
}

export type SortableListProps = Omit<ComponentProps<'ul'>, 'aria-label' | 'onReorder'> & {
  /** The ids of the items, in the order shown. The caller owns the order and updates it from `onReorder`. */
  ids: string[];
  /** Called with the whole new order when an item is dropped at another place; never on a cancel. */
  onReorder: (ids: string[]) => void;
  /** The caller names the list. */
  'aria-label': string;
  /** The sentences of the live region, from the caller. */
  announcements: SortableAnnouncements;
  /** How to pick up, move and drop with the keyboard; screen readers read it on the handle. */
  instructions: string;
  /** What a screen reader calls the handle ("item arrastável"), from the caller. */
  roleDescription?: string;
};

interface ListContext {
  roleDescription: string | undefined;
}

const SortableListContext = createContext<ListContext>({ roleDescription: undefined });

/** The dragged item moves up and down only. */
function verticalAxis({ transform }: { transform: { x: number; y: number; scaleX: number; scaleY: number } }) {
  return { ...transform, x: 0 };
}

/**
 * A list whose items are reordered by dragging the handle or, with the keyboard, by focusing the handle,
 * picking with `Space` or `Enter`, moving with the arrows and dropping with `Space` or `Enter`; `Esc`
 * gives the item back its place. It is a `ul`, so its items are `Sortable.Item`s. The `DndContext` id
 * comes from `useId`, so what the server renders is what the client hydrates.
 */
function List({
  ids,
  onReorder,
  announcements,
  instructions,
  roleDescription,
  children,
  ...props
}: SortableListProps) {
  const contextId = useId();
  // dnd-kit reports the item "over" its own place right after the pick; that is the pick, not a move.
  const lastOver = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function announcementFor(id: unknown, overId?: unknown): SortableAnnouncement {
    const own = ids.indexOf(String(id));
    const over = overId === undefined ? -1 : ids.indexOf(String(overId));
    return { id: String(id), position: (over === -1 ? own : over) + 1, total: ids.length };
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over === null || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalAxis]}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: instructions },
        announcements: {
          onDragStart: ({ active }) => {
            lastOver.current = String(active.id);
            return announcements.onPick(announcementFor(active.id));
          },
          onDragOver: ({ active, over }) => {
            const overId = over === null ? null : String(over.id);
            if (overId === null || overId === lastOver.current) return undefined;
            lastOver.current = overId;
            return announcements.onMove(announcementFor(active.id, overId));
          },
          onDragEnd: ({ active, over }) => announcements.onDrop(announcementFor(active.id, over?.id)),
          onDragCancel: ({ active }) => announcements.onCancel(announcementFor(active.id)),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <SortableListContext.Provider value={{ roleDescription }}>
          <ul {...props}>{children}</ul>
        </SortableListContext.Provider>
      </SortableContext>
    </DndContext>
  );
}

type SortableHandleProps = Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners'> & {
  setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef'];
  isDragging: boolean;
  roleDescription: string | undefined;
};

const SortableItemContext = createContext<SortableHandleProps | null>(null);

export type SortableItemProps = Omit<ComponentProps<'li'>, 'id'> & {
  /** The id of the item, one of the `ids` of the list. */
  id: string;
};

/** One item of the list. The handle inside it, `Sortable.Handle`, is what the person grabs. */
function Item({ id, className, style, children, ...props }: SortableItemProps) {
  const { roleDescription } = useContext(SortableListContext);
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging, transform, transition } =
    useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      data-dragging={isDragging ? '' : undefined}
      className={join('relative list-none', isDragging ? 'z-10 opacity-80' : undefined, className)}
      style={{
        ...style,
        transform: CSS.Translate.toString(transform),
        transition: transition,
      }}
      {...props}
    >
      <SortableItemContext.Provider
        value={{
          attributes,
          listeners,
          setActivatorNodeRef,
          isDragging: isDragging,
          roleDescription,
        }}
      >
        {children}
      </SortableItemContext.Provider>
    </li>
  );
}

export type SortableHandleButtonProps = Omit<ComponentProps<'button'>, 'type' | 'children' | 'aria-label'> & {
  /** The accessible name of the handle ("Mover Empresa Fictícia Alfa"), from the caller. */
  label: string;
};

/** The grip (`grip-vertical`) that starts the move, with the pointer or the keyboard. */
function Handle({ label, className, ...props }: SortableHandleButtonProps) {
  const item = useContext(SortableItemContext);
  if (item === null) throw new Error('Sortable.Handle must be inside a Sortable.Item');
  const { setActivatorNodeRef, attributes, listeners, isDragging, roleDescription } = item;

  return (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      {...props}
      type="button"
      aria-label={label}
      aria-roledescription={roleDescription}
      className={join(
        'inline-flex size-6 shrink-0 touch-none items-center justify-center rounded-sm text-text-muted',
        'transition-colors duration-150 hover:text-text',
        'outline-focus focus-visible:outline-2 focus-visible:-outline-offset-1',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
    >
      <Icon icon={GripVertical} />
    </button>
  );
}

/** A list reordered by dragging or by keyboard (AD-027), over `@dnd-kit`; no feature imports the library. */
export const Sortable = { List, Item, Handle };
