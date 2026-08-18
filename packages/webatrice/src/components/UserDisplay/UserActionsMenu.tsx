import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, generatePath } from 'react-router-dom';
import { MessageSquare, UserRoundPlus, UserRoundMinus, VolumeX, Volume2 } from 'lucide-react';

import { RouteEnum } from '@app/types';

interface UserActionsMenuProps {
  x: number;
  y: number;
  name: string;
  isABuddy: boolean;
  isIgnored: boolean;
  onClose: () => void;
  onAddBuddy: () => void;
  onRemoveBuddy: () => void;
  onAddIgnore: () => void;
  onRemoveIgnore: () => void;
}

/**
 * Portalled right-click context menu for a user name — shared between
 * `UserDisplay` (buddies / players-online lists) and any chat surface
 * that wants to expose the same actions on message-author names (see
 * `Message.PlayerLink`). Cockatrice-parity items: Private chat (opens
 * the Player page's chat panel), buddy toggle, ignore toggle.
 *
 * Closes on outside click, Escape, or after any option is chosen.
 * Portalled into `document.body` so it isn't clipped by ancestors with
 * `overflow: hidden` (chat log containers scroll internally).
 */
export default function UserActionsMenu({
  x,
  y,
  name,
  isABuddy,
  isIgnored,
  onClose,
  onAddBuddy,
  onRemoveBuddy,
  onAddIgnore,
  onRemoveIgnore,
}: UserActionsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay attaching the outside-click listener by a tick so the
    // contextmenu event that opened us doesn't immediately close us.
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', onDocClick);
    });
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Clamp the menu inside the viewport so a click near the bottom or
  // right edge doesn't spawn a menu that runs off-screen.
  const MENU_W = 200;
  const MENU_H = 160;
  const left = Math.min(x, window.innerWidth - MENU_W - 8);
  const top = Math.min(y, window.innerHeight - MENU_H - 8);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left, top }}
      className="fixed z-[9999] w-[200px] rounded-md bg-bg-surface border border-border-subtle shadow-glow py-1 select-none"
    >
      <NavLink
        to={generatePath(RouteEnum.PLAYER, { name })}
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        role="menuitem"
      >
        {/* Cockatrice-parity label. Opens the Player page which hosts
         *  the PrivateChat panel for this user. */}
        <MessageSquare size={14} /> Private chat
      </NavLink>
      <div className="my-1 border-t border-border-subtle" />
      {!isABuddy ? (
        <button
          type="button"
          onClick={onAddBuddy}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          role="menuitem"
        >
          <UserRoundPlus size={14} /> Add to Buddy List
        </button>
      ) : (
        <button
          type="button"
          onClick={onRemoveBuddy}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          role="menuitem"
        >
          <UserRoundMinus size={14} /> Remove from Buddy List
        </button>
      )}
      {!isIgnored ? (
        <button
          type="button"
          onClick={onAddIgnore}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          role="menuitem"
        >
          <VolumeX size={14} /> Add to Ignore List
        </button>
      ) : (
        <button
          type="button"
          onClick={onRemoveIgnore}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          role="menuitem"
        >
          <Volume2 size={14} /> Remove from Ignore List
        </button>
      )}
    </div>,
    document.body,
  );
}
