import { useState, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from 'react';
import type { ActionId, MenuShortcut } from '@app/feature-widgets/shortcuts';
import { Menu, type MenuAnchor } from '@app/components';

import ContextMenuEntries from './ContextMenuEntries';

export type ContextMenuItem =
  | {
      label: string;
      onClick?: () => void;
      disabled?: boolean;
      shortcut?: string;
      keyShortcuts?: string;
      submenu?: ContextMenuItem[];
      checked?: boolean;
      swatch?: string;
    }
  | { divider: true };

export type MenuShortcutFor = (actionId: ActionId) => MenuShortcut;

export function ContextMenuPopup({
  items,
  anchor,
  label,
  onClose,
  triggerRef,
}: {
  items: readonly ContextMenuItem[];
  anchor: MenuAnchor;
  label: string;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  return (
    <Menu anchor={anchor} label={label} onClose={onClose} triggerRef={triggerRef} className="min-w-[240px] max-w-[min(420px,100vw)]">
      <ContextMenuEntries items={items} />
    </Menu>
  );
}

export function contextMenuAnchor(event: MouseEvent<HTMLElement>): MenuAnchor {
  return event.clientX === 0 && event.clientY === 0
    ? { rect: event.currentTarget.getBoundingClientRect(), placement: 'below' }
    : { x: event.clientX, y: event.clientY };
}

export default function ContextMenu({
  items,
  label,
  children,
  wrapperClassName,
  wrapperStyle,
}: {
  items: readonly ContextMenuItem[];
  label: string;
  children: ReactNode;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
}) {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return (
    <>
      <div
        className={wrapperClassName}
        style={wrapperStyle}
        onContextMenu={(event) => {
          event.preventDefault();
          setAnchor(contextMenuAnchor(event));
        }}
      >
        {children}
      </div>
      {anchor && <ContextMenuPopup items={items} anchor={anchor} label={label} onClose={() => setAnchor(null)} />}
    </>
  );
}
