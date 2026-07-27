import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useViewportClampedPopup } from "./useViewportClampedPopup";

/**
 * A right-click context menu that overrides the browser's default menu.
 *
 * Wrap any element in `<ContextMenu items={…}>` and right-clicks anywhere
 * inside will:
 *   1. call `e.preventDefault()` to suppress the browser menu
 *   2. render a portal-based popup at the cursor position with the given items
 *   3. close on outside click, escape, or after an item's onClick fires
 *
 * Items with `disabled: true` render dimmed and don't fire onClick.
 * A `divider: true` item renders a horizontal line instead. Items with
 * `submenu` render a right-arrow ▶ indicator and open a nested menu on
 * hover; items with neither `onClick` nor `submenu` render as disabled
 * placeholders (useful for showing menu items that aren't wired up yet).
 */
export type ContextMenuItem =
  | {
      label: string;
      /** Fires when the item is clicked (unless disabled). Items with
       *  a `submenu` typically omit `onClick` — hovering opens the
       *  nested menu instead. If both are set, the click still fires
       *  and dismisses the whole popup. */
      onClick?: () => void;
      disabled?: boolean;
      /** Optional keyboard-shortcut hint shown right-aligned. */
      shortcut?: string;
      /** Nested items — rendered as a flyout to the right on hover.
       *  When present, a ▶ chevron is drawn instead of a shortcut. */
      submenu?: ContextMenuItem[];
      /** Toggle-item flag. When true, a leading ✓ is rendered before
       *  the label (matching Qt's `QAction::setCheckable(true)` look).
       *  When false but defined (i.e. present on a toggleable item),
       *  a leading space reserves the same slot so labels stay
       *  vertically aligned across checked / unchecked entries. */
      checked?: boolean;
    }
  | { divider: true };

type Props = {
  items: ContextMenuItem[];
  children: ReactNode;
  /** Passed through to the wrapper `<div>` so callers can preserve
   *  layout — e.g. an absolutely-positioned pile-view card needs to
   *  keep its own positioning styles rather than losing them to a
   *  bare wrapper. Optional. */
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
};

export default function ContextMenu({
  items,
  children,
  wrapperClassName,
  wrapperStyle,
}: Props) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    if (!position) return;
    const onDown = (e: MouseEvent) => {
      // Any click anywhere (inside or outside the menu) dismisses it. Items
      // handle their own click first via onClick, which sets position=null
      // before this fires.
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-context-menu]")) return;
      setPosition(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosition(null);
    };
    // Slight delay so the right-click that opened the menu doesn't immediately
    // close it via the mousedown listener.
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [position]);

  return (
    <>
      <div
        className={wrapperClassName}
        style={wrapperStyle}
        onContextMenu={(e) => {
          e.preventDefault();
          setPosition({ x: e.clientX, y: e.clientY });
        }}
      >
        {children}
      </div>
      {position &&
        createPortal(
          <MenuList
            items={items}
            x={position.x}
            y={position.y}
            onDismiss={() => setPosition(null)}
          />,
          document.body,
        )}
    </>
  );
}

/** Renders a menu popup at (x, y). Extracted so submenus can reuse
 *  the same rendering path — a submenu is just another MenuList
 *  positioned relative to its parent item. */
function MenuList({
  items,
  x,
  y,
  onDismiss,
}: {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onDismiss: () => void;
}) {
  // Which item's submenu is currently open. -1 = none. Set on hover;
  // cleared when hovering a different item.
  const [openSubmenu, setOpenSubmenu] = useState<number>(-1);
  // Anchor rect for the open submenu so it can position itself flush
  // with the parent item's right edge.
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // Viewport-clamped position — flips left / shifts up when the popup
  // would overflow. Same helper the card context menu uses so a
  // right-click near a screen edge doesn't clip the menu.
  const { ref: popupRef, pos } = useViewportClampedPopup(x, y);
  // If any item in this menu is checkable, reserve the ✓ slot on
  // every row so labels line up regardless of checked state — matches
  // native menu conventions (macOS / Qt), where a menu with any
  // checkable action indents ALL rows to accommodate the check
  // column. Without this, mixing "Always reveal top card" (checkable)
  // with "View library" (not) in the same menu would visibly indent
  // just the checkable rows.
  const menuHasCheckable = items.some(
    (item) => !("divider" in item) && item.checked !== undefined,
  );
  return (
    <div
      ref={popupRef}
      data-context-menu
      className="fixed z-[9999] min-w-[160px] rounded-md border border-border-subtle bg-bg-surface shadow-glow py-1"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) => {
        if ("divider" in item) {
          return (
            <div
              key={`d-${i}`}
              className="my-1 border-t border-border-subtle"
            />
          );
        }
        const hasSubmenu = !!item.submenu && item.submenu.length > 0;
        // "Placeholder" items: no onClick + no submenu → render as
        // disabled so an unwired feature reads as such at a glance.
        const effectivelyDisabled =
          item.disabled || (!item.onClick && !hasSubmenu);
        const rect = itemRefs.current[i]?.getBoundingClientRect();
        return (
          <div key={`i-${i}`} className="relative">
            <button
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              disabled={effectivelyDisabled}
              onClick={() => {
                if (effectivelyDisabled) return;
                if (item.onClick) {
                  item.onClick();
                  onDismiss();
                }
              }}
              onMouseEnter={() => {
                setOpenSubmenu(hasSubmenu ? i : -1);
              }}
              className="w-full flex items-center gap-4 px-3 py-1.5 text-sm text-left text-text-primary hover:bg-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {menuHasCheckable && (
                <span
                  aria-hidden
                  className="w-3 text-text-primary text-xs shrink-0"
                >
                  {item.checked ? "✓" : ""}
                </span>
              )}
              <span className="flex-1">{item.label}</span>
              {hasSubmenu ? (
                <span className="text-xs text-text-muted" aria-hidden>
                  ▶
                </span>
              ) : item.shortcut ? (
                <span className="text-xs text-text-muted">
                  {item.shortcut}
                </span>
              ) : null}
            </button>
            {hasSubmenu && openSubmenu === i && rect && (
              <MenuList
                items={item.submenu!}
                x={rect.right}
                y={rect.top}
                onDismiss={onDismiss}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
