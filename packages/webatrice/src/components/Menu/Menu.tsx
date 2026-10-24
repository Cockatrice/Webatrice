import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';

import { closestList, focusFallback, tabbableElements, useDialogReturnFocus } from '../../hooks/useDialogFocus';

export interface MenuRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type MenuAnchor =
  | {
    x: number;
    y: number;
    align?: 'start' | 'end';
  }
  | {
    rect: MenuRect;
    placement: 'below' | 'right';
    align?: 'start' | 'end';
  };

export interface MenuProps {
  anchor: MenuAnchor;
  label: string;
  describedBy?: string;
  onClose: () => void;
  triggerRef?: RefObject<HTMLElement | null>;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';
const EDGE = 8;
export const SUBMENU_OPEN_DELAY = 200;
export const SUBMENU_CLOSE_DELAY = 300;
export const TYPEAHEAD_TIMEOUT = 500;

export const MENU_ITEM_CLASS =
  'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-text-secondary '
  + 'hover:text-text-primary hover:bg-bg-elevated focus:text-text-primary focus:bg-bg-elevated '
  + 'focus:outline-none transition-colors '
  + 'aria-disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent';

interface MenuLevel {
  ancestors: string[];
  portalTarget: HTMLElement;
  openSubmenu: string | null;
  setOpenSubmenu: (id: string | null) => void;
  closeAll: () => void;
}

const MenuLevelContext = createContext<MenuLevel | null>(null);

function menuItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR))
    .filter((item) => item.closest('[role="menu"]') === menu && !item.matches(':disabled'));
}

export function placeMenu(
  anchor: MenuAnchor,
  { width, height }: { width: number; height: number },
  viewport: { width: number; height: number } = { width: window.innerWidth, height: window.innerHeight },
): { left: number; top: number; maxHeight: number } {
  let left: number;
  let top: number;
  const fitsRight = (x: number) => x + width <= viewport.width - EDGE;
  const fitsBelow = (y: number) => y + height <= viewport.height - EDGE;
  if ('rect' in anchor) {
    const { rect, placement } = anchor;
    if (placement === 'right') {
      left = fitsRight(rect.right) || rect.left - width < EDGE ? rect.right : rect.left - width;
      top = fitsBelow(rect.top - 4) || rect.bottom + 4 - height < EDGE ? rect.top - 4 : rect.bottom + 4 - height;
    } else {
      left = anchor.align === 'end' ? rect.right - width : rect.left;
      top = fitsBelow(rect.bottom + 2) || rect.top - 2 - height < EDGE ? rect.bottom + 2 : rect.top - 2 - height;
    }
  } else {
    const { x, y } = anchor;
    if (anchor.align === 'end') {
      left = x - width >= EDGE || !fitsRight(x) ? x - width : x;
    } else {
      left = fitsRight(x) || x - width < EDGE ? x : x - width;
    }
    top = fitsBelow(y) || y - height < EDGE ? y : y - height;
  }
  left = Math.max(EDGE, Math.min(left, viewport.width - width - EDGE));
  top = Math.max(EDGE, Math.min(top, viewport.height - height - EDGE));
  return { left, top, maxHeight: viewport.height - top - EDGE };
}

function anchorKey(anchor: MenuAnchor): string {
  return 'rect' in anchor
    ? `${anchor.placement}:${anchor.align}:${anchor.rect.left},${anchor.rect.top},${anchor.rect.right},${anchor.rect.bottom}`
    : `${anchor.align}:${anchor.x},${anchor.y}`;
}

export function Menu({
  anchor, label, describedBy, onClose, triggerRef, autoFocus = true, id, className, onKeyDown: onShortcutKey, children,
}: MenuProps) {
  const parent = useContext(MenuLevelContext);
  const menuIdentity = useId();
  const [portalTarget] = useState(() => parent?.portalTarget
    ?? (triggerRef?.current ?? document.activeElement)?.closest<HTMLElement>('[data-modal-layer],.MuiModal-root')
    ?? document.body);
  const ancestors = [...(parent?.ancestors ?? []), menuIdentity];
  const returnFocusTo = useDialogReturnFocus();
  const tabDirection = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const placement = anchorKey(anchor);
  const [placed, setPlaced] = useState<{ for: string; position: ReturnType<typeof placeMenu> } | null>(null);
  const position = placed?.for === placement ? placed.position : null;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const typed = useRef({ text: '', at: 0 });
  const closeTimer = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (position) {
      return;
    }
    const { width, height } = ref.current?.getBoundingClientRect() ?? { width: 0, height: 0 };
    setPlaced({ for: placement, position: placeMenu(anchor, { width, height }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-placed when the anchor's numbers change
  }, [placement, position]);

  useLayoutEffect(() => {
    const menu = ref.current;
    const opener = triggerRef?.current
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const fallback = opener ? (returnFocusTo ?? closestList)(opener) : null;
    return () => {
      const active = document.activeElement;
      const ours = active == null || active === document.body || menu?.contains(active)
        || active.closest('[role="menu"]')?.getAttribute('data-menu-ancestors')?.split(' ').includes(menuIdentity);
      if (!ours) {
        return;
      }
      if (opener?.isConnected) {
        if (tabDirection.current != null) {
          const stops = tabbableElements(document.body).filter((item) => !item.closest('[role="menu"]'));
          const index = stops.indexOf(opener);
          const next = stops[index + tabDirection.current];
          if (next) {
            next.focus();
          } else {
            focusFallback(document.body);
          }
        } else {
          opener.focus();
        }
      } else if (fallback?.isConnected) {
        focusFallback(fallback);
      }
    };
    // Mount/unmount only: re-anchoring an open menu must not pull focus back to its first item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (autoFocus && menu && !menu.contains(document.activeElement)) {
      menuItems(menu)[0]?.focus();
    }
  }, [autoFocus]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (parent) {
      return;
    }
    const onPress = (event: globalThis.MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('[role="menu"]') || triggerRef?.current?.contains(target)) {
        return;
      }
      onCloseRef.current();
    };
    const frame = requestAnimationFrame(() => document.addEventListener('mousedown', onPress));
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', onPress);
    };
  }, [parent, triggerRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menu = ref.current;
    if (event.key === 'Tab') {
      if (!parent) {
        event.preventDefault();
        tabDirection.current = event.shiftKey ? -1 : 1;
        onClose();
      }
      return;
    }
    if (!menu || (event.target as Element).closest('[role="menu"]') !== menu) {
      return;
    }
    onShortcutKey?.(event);
    if (event.defaultPrevented) {
      event.stopPropagation();
      return;
    }
    const items = menuItems(menu);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => {
      const next = items[(i + items.length) % items.length];
      next?.focus();
      typed.current = { text: '', at: 0 };
      if (openSubmenu != null && next?.dataset.submenu !== openSubmenu) {
        window.clearTimeout(closeTimer.current);
        setOpenSubmenu(null);
      }
    };
    switch (event.key) {
      case 'ArrowDown':
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        focusAt(index < 0 ? -1 : index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(-1);
        break;
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        if (!parent) {
          return;
        }
        onClose();
        break;
      default: {
        if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }
        const key = event.key.toLocaleLowerCase();
        const now = Date.now();
        const searching = typed.current.text !== '' && now - typed.current.at <= TYPEAHEAD_TIMEOUT;
        if (key === ' ' && !searching) {
          return;
        }
        const text = searching ? typed.current.text + key : key;
        typed.current = { text, at: now };
        const cycling = [...text].every((letter) => letter === key);
        const prefix = cycling ? key : text;
        const start = cycling ? index + 1 : Math.max(index, 0);
        const next = [...items.slice(start), ...items.slice(0, start)]
          .find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(prefix));
        next?.focus();
      }
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const onMouseOver = (event: MouseEvent<HTMLDivElement>) => {
    const menu = ref.current;
    const target = event.target as Element;
    const item = target.closest<HTMLElement>(ITEM_SELECTOR);
    if (!menu || !menu.contains(target)) {
      window.clearTimeout(closeTimer.current);
      return;
    }
    if (!item || item.closest('[role="menu"]') !== menu) {
      return;
    }
    if (document.activeElement !== item) {
      item.focus({ preventScroll: true });
      typed.current = { text: '', at: 0 };
    }
    window.clearTimeout(closeTimer.current);
    if (openSubmenu != null && item.dataset.submenu !== openSubmenu) {
      closeTimer.current = window.setTimeout(() => setOpenSubmenu(null), SUBMENU_CLOSE_DELAY);
    }
  };

  const level: MenuLevel = {
    ancestors,
    portalTarget,
    openSubmenu,
    setOpenSubmenu: (submenu) => {
      window.clearTimeout(closeTimer.current);
      setOpenSubmenu(submenu);
    },
    closeAll: parent?.closeAll ?? onClose,
  };

  return createPortal(
    <MenuLevelContext.Provider value={level}>
      <div
        ref={ref}
        id={id}
        role="menu"
        data-menu-ancestors={ancestors.join(' ')}
        aria-label={label}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={position ?? { left: 0, top: 0 }}
        onKeyDown={onKeyDown}
        onMouseOver={onMouseOver}
        onContextMenu={(event) => event.preventDefault()}
        className={[
          'fixed z-[9999] overflow-y-auto rounded-md bg-bg-surface border border-border-subtle shadow-glow py-1',
          'select-none focus:outline-none',
          className ?? 'w-[200px]',
        ].join(' ')}
      >
        {children}
      </div>
    </MenuLevelContext.Provider>,
    portalTarget,
  );
}

interface MenuEntryProps {
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
  shortcut?: string;
  keyShortcuts?: string;
  title?: string;
  closeOnSelect?: boolean;
  children: ReactNode;
}

interface MenuEntryButtonProps extends Omit<MenuEntryProps, 'closeOnSelect'> {
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  checked?: boolean;
  onActivate: () => void;
  closeOnSelect: boolean;
  indicator?: ReactNode;
}

function MenuEntryButton({
  role,
  checked,
  onActivate,
  disabled,
  disabledReason,
  icon,
  shortcut,
  keyShortcuts,
  title,
  closeOnSelect,
  indicator,
  children,
}: MenuEntryButtonProps) {
  const level = useContext(MenuLevelContext);
  const reasonId = useId();
  const reason = disabled ? disabledReason : undefined;
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      aria-describedby={reason ? reasonId : undefined}
      title={reason ?? title}
      aria-keyshortcuts={keyShortcuts}
      onClick={() => {
        if (disabled) {
          return;
        }
        onActivate();
        if (closeOnSelect) {
          level?.closeAll();
        }
      }}
      className={MENU_ITEM_CLASS}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-xs text-text-muted" aria-hidden>{shortcut}</span>}
      {indicator}
      {reason && <span id={reasonId} hidden>{reason}</span>}
    </button>
  );
}

export interface MenuItemProps extends MenuEntryProps {
  onSelect: () => void;
}

export function MenuItem({ onSelect, closeOnSelect = true, ...props }: MenuItemProps) {
  return <MenuEntryButton role="menuitem" onActivate={onSelect} closeOnSelect={closeOnSelect} {...props} />;
}

export interface MenuCheckboxItemProps extends MenuEntryProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function MenuCheckboxItem({ checked, onChange, closeOnSelect = false, ...props }: MenuCheckboxItemProps) {
  return (
    <MenuEntryButton
      role="menuitemcheckbox"
      checked={checked}
      onActivate={() => onChange(!checked)}
      closeOnSelect={closeOnSelect}
      indicator={<span className="w-3 text-xs text-accent" aria-hidden>{checked ? '✓' : ''}</span>}
      {...props}
    />
  );
}

export interface MenuRadioItemProps extends MenuEntryProps {
  checked: boolean;
  onSelect: () => void;
}

export function MenuRadioItem({ checked, onSelect, closeOnSelect = false, ...props }: MenuRadioItemProps) {
  return (
    <MenuEntryButton
      role="menuitemradio"
      checked={checked}
      onActivate={onSelect}
      closeOnSelect={closeOnSelect}
      indicator={<span className="w-3 text-xs text-accent" aria-hidden>{checked ? '●' : ''}</span>}
      {...props}
    />
  );
}

export interface MenuGroupProps {
  label: string;
  children: ReactNode;
}

export function MenuGroup({ label, children }: MenuGroupProps) {
  return <div role="group" aria-label={label}>{children}</div>;
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-border-subtle" />;
}

export interface MenuSubmenuProps {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  children: ReactNode;
}

export function MenuSubmenu({ label, icon, disabled, disabledReason, className, children }: MenuSubmenuProps) {
  const level = useContext(MenuLevelContext);
  const id = useId();
  const menuId = `${id}menu`;
  const reasonId = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const [focusIn, setFocusIn] = useState(false);
  const openTimer = useRef<number | undefined>(undefined);
  const open = level?.openSubmenu === id && anchor != null;
  const reason = disabled ? disabledReason : undefined;

  useEffect(() => () => window.clearTimeout(openTimer.current), []);

  const show = (moveFocus: boolean) => {
    window.clearTimeout(openTimer.current);
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || disabled) {
      return;
    }
    if (open) {
      const submenu = document.getElementById(menuId);
      if (moveFocus && submenu) {
        menuItems(submenu)[0]?.focus();
      }
      return;
    }
    setFocusIn(moveFocus);
    setAnchor({ rect, placement: 'right' });
    level?.setOpenSubmenu(id);
  };
  const hide = () => level?.setOpenSubmenu(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-disabled={disabled || undefined}
        aria-describedby={reason ? reasonId : undefined}
        title={reason}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-submenu={id}
        onClick={() => show(true)}
        onMouseEnter={() => {
          window.clearTimeout(openTimer.current);
          openTimer.current = window.setTimeout(() => show(false), SUBMENU_OPEN_DELAY);
        }}
        onMouseLeave={() => window.clearTimeout(openTimer.current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            show(true);
          }
        }}
        className={MENU_ITEM_CLASS}
      >
        {icon}
        <span className="flex-1">{label}</span>
        <ChevronRight size={14} aria-hidden />
        {reason && <span id={reasonId} hidden>{reason}</span>}
      </button>
      {open && (
        <Menu
          id={menuId}
          anchor={anchor}
          label={label}
          onClose={hide}
          triggerRef={ref}
          autoFocus={focusIn}
          className={className}
        >
          {children}
        </Menu>
      )}
    </>
  );
}

export interface ContextMenuTrigger {
  anchor: MenuAnchor | null;
  triggerRef: RefObject<HTMLElement | null>;
  close: () => void;
  getTriggerProps: () => {
    onContextMenu: (event: MouseEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
  };
}

export function isContextMenuKey(event: KeyboardEvent): boolean {
  if (event.key === 'ContextMenu') {
    return true;
  }
  return event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
}

export function useContextMenu(): ContextMenuTrigger {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openBelow = (element: HTMLElement) => {
    setAnchor({ rect: element.getBoundingClientRect(), placement: 'below' });
  };

  const close = useCallback(() => setAnchor(null), []);

  return {
    anchor,
    triggerRef,
    close,
    getTriggerProps: () => ({
      onContextMenu: (event) => {
        event.preventDefault();
        triggerRef.current = event.currentTarget;
        if (event.clientX === 0 && event.clientY === 0) {
          openBelow(event.currentTarget);
        } else {
          setAnchor({ x: event.clientX, y: event.clientY });
        }
      },
      onKeyDown: (event) => {
        if (isContextMenuKey(event)) {
          event.preventDefault();
          triggerRef.current = event.currentTarget;
          openBelow(event.currentTarget);
        }
      },
      'aria-haspopup': 'menu',
      'aria-expanded': anchor != null,
    }),
  };
}
