import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';

import type { ContextMenuItem } from '../../PlayerBox/ContextMenu';
import { useViewportClampedPopup } from '../../PlayerBox/useViewportClampedPopup';

/**
 * Right-click context menu for PlayerList rows. Ports
 * `Cockatrice/cockatrice/src/interface/widgets/server/user/user_context_menu.cpp:348`
 * (the `showContextMenu` overload) into a Tailwind popup. Item visibility
 * mirrors Cockatrice's role gating exactly:
 *
 *   - Always shown: header label, User details, Private chat
 *   - Both users registered: Add/remove buddy + ignore toggles
 *   - Local user is host or moderator: Kick from game
 *   - Local user is moderator: Warn/Ban + history + admin notes
 *   - Local user is admin: Promote/demote moderator + judge
 *
 * This is a "controlled" popup — the parent tracks {anchor, target} in
 * state and passes them in. That avoids wrapping each `<li>` in a
 * ContextMenu `<div>` (invalid HTML inside `<ul>`) and lets the same
 * portal serve every row.
 */

export interface PlayerListMenuTarget {
  userName: string;
  deckHash: string;
  targetIsRegistered: boolean;
  isSelf: boolean;
}

export interface PlayerListMenuLocal {
  isHost: boolean;
  isRegistered: boolean;
  isModerator: boolean;
  isAdmin: boolean;
}

export interface PlayerListMenuActions {
  onCopyHashToClipboard: (deckHash: string) => void;
  onOpenUserDetails: (userName: string) => void;
  onOpenPrivateChat: (userName: string) => void;
  onAddBuddy: (userName: string) => void;
  onRemoveBuddy: (userName: string) => void;
  onAddIgnore: (userName: string) => void;
  onRemoveIgnore: (userName: string) => void;
  onKickFromGame: (userName: string) => void;
  onOpenWarn: (userName: string) => void;
  onOpenWarnHistory: (userName: string) => void;
  onOpenBan: (userName: string) => void;
  onOpenBanHistory: (userName: string) => void;
  onOpenAdminNotes: (userName: string) => void;
  onAdjustMod: (userName: string, shouldBeMod: boolean) => void;
  onAdjustJudge: (userName: string, shouldBeJudge: boolean) => void;
}

interface Props {
  anchor: { x: number; y: number } | null;
  target: PlayerListMenuTarget | null;
  local: PlayerListMenuLocal;
  buddyList: { [userName: string]: ServerInfo_User };
  ignoreList: { [userName: string]: ServerInfo_User };
  targetUserFromServer: ServerInfo_User | undefined;
  actions: PlayerListMenuActions;
  onDismiss: () => void;
}

function targetHasLevelFlag(user: ServerInfo_User | undefined, flag: ServerInfo_User_UserLevelFlag): boolean {
  if (!user) {
    return false;
  }
  return (user.userLevel & flag) === flag;
}

function buildItems(
  target: PlayerListMenuTarget,
  local: PlayerListMenuLocal,
  buddyList: Props['buddyList'],
  ignoreList: Props['ignoreList'],
  targetUserFromServer: ServerInfo_User | undefined,
  actions: PlayerListMenuActions,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  // Header — Cockatrice renders the user name as the first (disabled)
  // item so a right-clicked row always shows WHO is being acted on.
  items.push({ label: target.userName, disabled: true });
  items.push({ divider: true });

  if (target.deckHash) {
    items.push({
      label: 'Copy hash to clipboard',
      onClick: () => actions.onCopyHashToClipboard(target.deckHash),
    });
  }
  items.push({
    label: 'User details',
    onClick: () => actions.onOpenUserDetails(target.userName),
  });
  // Cockatrice disables Private chat when viewing yourself
  // (user_context_menu.cpp:376). We follow the same gate.
  items.push({
    label: 'Private chat',
    onClick: () => actions.onOpenPrivateChat(target.userName),
    disabled: target.isSelf,
  });

  // Buddy/ignore — only offered when BOTH users are registered
  // (Cockatrice checks own-user + target-user registered flags at
  // user_context_menu.cpp:379-382). Toggle label reflects current state.
  if (local.isRegistered && target.targetIsRegistered && !target.isSelf) {
    items.push({ divider: true });
    const isBuddy = !!buddyList[target.userName];
    items.push({
      label: isBuddy ? 'Remove from buddy list' : 'Add to buddy list',
      onClick: () => (isBuddy
        ? actions.onRemoveBuddy(target.userName)
        : actions.onAddBuddy(target.userName)),
    });
    const isIgnored = !!ignoreList[target.userName];
    items.push({
      label: isIgnored ? 'Remove from ignore list' : 'Add to ignore list',
      onClick: () => (isIgnored
        ? actions.onRemoveIgnore(target.userName)
        : actions.onAddIgnore(target.userName)),
    });
  }

  // Kick from game — Cockatrice offers this to the game host OR when
  // the server isn't admin-locked (user_context_menu.cpp:386). We
  // don't model admin-locked; gate on host or moderator (moderator
  // kick matches admin-unlocked behaviour in practice).
  if (!target.isSelf && (local.isHost || local.isModerator)) {
    items.push({ divider: true });
    items.push({
      label: 'Kick from game',
      onClick: () => actions.onKickFromGame(target.userName),
    });
  }

  if (local.isModerator && !target.isSelf) {
    items.push({ divider: true });
    items.push({
      label: 'Warn user',
      onClick: () => actions.onOpenWarn(target.userName),
    });
    items.push({
      label: 'View user\'s warn history',
      onClick: () => actions.onOpenWarnHistory(target.userName),
    });
    items.push({ divider: true });
    items.push({
      label: 'Ban from server',
      onClick: () => actions.onOpenBan(target.userName),
    });
    items.push({
      label: 'View user\'s ban history',
      onClick: () => actions.onOpenBanHistory(target.userName),
    });
    items.push({ divider: true });
    items.push({
      label: 'View admin notes',
      onClick: () => actions.onOpenAdminNotes(target.userName),
    });
  }

  // Admin-only role adjustments. Cockatrice gates these on the local
  // user's IsAdmin flag (user_context_menu.cpp:401-411). Labels flip
  // between Promote/Demote based on the target's current userLevel.
  if (local.isAdmin && !target.isSelf) {
    items.push({ divider: true });
    const isMod = targetHasLevelFlag(targetUserFromServer, ServerInfo_User_UserLevelFlag.IsModerator);
    items.push({
      label: isMod ? 'Demote user from moderator' : 'Promote user to moderator',
      onClick: () => actions.onAdjustMod(target.userName, !isMod),
    });
    const isJudge = targetHasLevelFlag(targetUserFromServer, ServerInfo_User_UserLevelFlag.IsJudge);
    items.push({
      label: isJudge ? 'Demote user from judge' : 'Promote user to judge',
      onClick: () => actions.onAdjustJudge(target.userName, !isJudge),
    });
  }

  return items;
}

// Local rendering copy of ContextMenu's popup — kept in this file so
// this component stays self-contained (the PlayerBox ContextMenu is
// a wrapper primitive that owns its own right-click and children,
// which isn't what we need here). Uses the same viewport-clamped
// popup hook the PlayerBox menu uses so behaviour stays consistent.
function PlayerListContextMenu({
  anchor,
  target,
  local,
  buddyList,
  ignoreList,
  targetUserFromServer,
  actions,
  onDismiss,
}: Props) {
  const isOpen = anchor != null && target != null;
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-player-context-menu]')) {
        return;
      }
      onDismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    // Slight delay so the right-click that opened the menu doesn't
    // immediately close it via the mousedown listener.
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onDismiss]);

  if (!isOpen) {
    return null;
  }
  const items = buildItems(
    target,
    local,
    buddyList,
    ignoreList,
    targetUserFromServer,
    actions,
  );
  return createPortal(
    <MenuList items={items} x={anchor.x} y={anchor.y} onDismiss={onDismiss} />,
    document.body,
  );
}

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
  const [openSubmenu, setOpenSubmenu] = useState<number>(-1);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { ref: popupRef, pos } = useViewportClampedPopup(x, y);
  return (
    <div
      ref={popupRef}
      data-player-context-menu
      className={
        'fixed z-[9999] min-w-[200px] rounded-md border border-border-subtle '
        + 'bg-bg-surface shadow-glow py-1'
      }
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((item, i) => {
        if ('divider' in item) {
          return (
            <div
              key={`d-${i}`}
              className="my-1 border-t border-border-subtle"
            />
          );
        }
        const hasSubmenu = !!item.submenu && item.submenu.length > 0;
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
                if (effectivelyDisabled) {
                  return;
                }
                if (item.onClick) {
                  item.onClick();
                  onDismiss();
                }
              }}
              onMouseEnter={() => {
                setOpenSubmenu(hasSubmenu ? i : -1);
              }}
              className={
                'w-full flex items-center gap-4 px-3 py-1.5 text-sm text-left '
                + 'text-text-primary hover:bg-bg-elevated disabled:opacity-50 '
                + 'disabled:cursor-not-allowed transition-colors'
              }
            >
              <span className="flex-1">{item.label}</span>
              {hasSubmenu ? (
                <span className="text-xs text-text-muted" aria-hidden>
                  ▶
                </span>
              ) : item.shortcut ? (
                <span className="text-xs text-text-muted">{item.shortcut}</span>
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

export default memo(PlayerListContextMenu);
