import { useEffect, useRef, useState, type ReactNode } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import type { MenuItemProps } from '@mui/material/MenuItem';

// Delay (ms) before a hovered-out trigger closes its submenu. The window
// gives the cursor time to traverse from the trigger to the submenu paper
// without flicker; the paper's onMouseEnter cancels the pending close so
// only sibling-trigger hover actually swaps which submenu is open.
const SUBMENU_CLOSE_DELAY_MS = 150;

export interface NestedMenuItemProps extends Omit<MenuItemProps, 'children'> {
  label: ReactNode;
  children: ReactNode;
  // Propagated open state of the enclosing Menu. The submenu auto-closes
  // whenever the parent closes so a click that closes the parent (e.g. an
  // action handler in the submenu calling its own onClose) tears the whole
  // menu chain down at once.
  parentMenuOpen: boolean;
}

export function NestedMenuItem({
  label,
  children,
  parentMenuOpen,
  disabled,
  ...rest
}: NestedMenuItemProps) {
  const itemRef = useRef<HTMLLIElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);

  const cancelPendingClose = () => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelPendingClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, SUBMENU_CLOSE_DELAY_MS);
  };

  useEffect(() => {
    if (!parentMenuOpen && open) {
      cancelPendingClose();
      setOpen(false);
    }
  }, [parentMenuOpen, open]);

  // Always tear down a pending timer on unmount so we don't fire setOpen on
  // an unmounted component (e.g. when the parent Menu unmounts mid-delay).
  useEffect(() => () => cancelPendingClose(), []);

  return (
    <>
      <MenuItem
        ref={itemRef}
        disabled={disabled}
        onMouseEnter={() => {
          if (disabled) {
            return;
          }
          cancelPendingClose();
          setOpen(true);
        }}
        onMouseLeave={() => {
          // Schedule a close instead of firing immediately — the submenu
          // paper's onMouseEnter (below) cancels this, so traversing from
          // trigger → paper keeps the submenu open. Hovering a sibling
          // trigger lets the close land before the sibling opens its own
          // submenu, ensuring only one submenu is open at a time.
          if (!disabled) {
            scheduleClose();
          }
        }}
        onClick={() => {
          if (!disabled) {
            cancelPendingClose();
            setOpen((prev) => !prev);
          }
        }}
        {...rest}
      >
        <span style={{ flex: 1 }}>{label}</span>
        <span aria-hidden="true" style={{ marginLeft: 12, opacity: 0.7 }}>▸</span>
      </MenuItem>
      <Menu
        anchorEl={itemRef.current}
        open={open && parentMenuOpen}
        onClose={() => {
          cancelPendingClose();
          setOpen(false);
        }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        // The submenu lives inside the parent Menu's portaled root; disable
        // focus traps so clicking the submenu doesn't fight the parent's
        // focus management. Mouse-driven UX is the primary path here.
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        slotProps={{
          paper: {
            onMouseEnter: cancelPendingClose,
            onMouseLeave: () => {
              cancelPendingClose();
              setOpen(false);
            },
          },
        }}
      >
        {children}
      </Menu>
    </>
  );
}

export default NestedMenuItem;
