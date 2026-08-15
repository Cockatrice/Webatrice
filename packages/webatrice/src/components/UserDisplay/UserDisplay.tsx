import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, generatePath } from 'react-router-dom';
import { MessageSquare, UserRoundPlus, UserRoundMinus, VolumeX, Volume2 } from 'lucide-react';

import { Images } from '@app/images';
import { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';
import { UserBadges } from '../UserBadges/UserBadges';
import { useUserDisplay } from './useUserDisplay';

import './UserDisplay.css';

interface UserDisplayProps {
  user: ServerInfo_User;
}

const UserDisplay = ({ user }: UserDisplayProps) => {
  const { name, country, userLevel } = user;
  const {
    position,
    isABuddy,
    isIgnored,
    handleClick,
    handleClose,
    onAddBuddy,
    onRemoveBuddy,
    onAddIgnore,
    onRemoveIgnore,
  } = useUserDisplay(name);

  return (
    <div className="user-display">
      <NavLink to={generatePath(RouteEnum.PLAYER, { name })} className="plain-link">
        <div className="user-display__details" onContextMenu={handleClick}>
          <img className="user-display__country" src={Images.Countries[country]} alt={country} />
          <div className="user-display__name single-line-ellipsis">{name}</div>
          <UserBadges userLevel={userLevel} size={12} className="ml-1" />
        </div>
      </NavLink>
      {position && (
        <ContextMenu
          x={position.x}
          y={position.y}
          onClose={handleClose}
          name={name}
          isABuddy={isABuddy}
          isIgnored={isIgnored}
          onAddBuddy={onAddBuddy}
          onRemoveBuddy={onRemoveBuddy}
          onAddIgnore={onAddIgnore}
          onRemoveIgnore={onRemoveIgnore}
        />
      )}
    </div>
  );
};

interface ContextMenuProps {
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
 * Right-click context menu for a user row. Portalled into
 * `document.body` so it isn't clipped by ancestors with
 * `overflow: hidden`. Closes on outside click, Escape, or after any
 * option is chosen (the onAdd/onRemove callbacks from useUserDisplay
 * already call `handleClose` themselves).
 */
function ContextMenu({
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
}: ContextMenuProps) {
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
        <MessageSquare size={14} /> Chat
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

export default UserDisplay;
