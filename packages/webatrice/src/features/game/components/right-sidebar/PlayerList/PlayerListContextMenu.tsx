import { memo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { Menu, MenuSeparator, type MenuAnchor } from '@app/components';

import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import ContextMenuEntries from '../../context-menus/ContextMenu/ContextMenuEntries';

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
  canReport?: boolean;
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
  onReportUser?: (userName: string) => void;
}

interface Props {
  anchor: MenuAnchor | null;
  triggerRef?: RefObject<HTMLElement | null>;
  target: PlayerListMenuTarget | null;
  local: PlayerListMenuLocal;
  buddyList: { [userName: string]: ServerInfo_User };
  ignoreList: { [userName: string]: ServerInfo_User };
  moderationItems: ContextMenuItem[];
  actions: PlayerListMenuActions;
  onDismiss: () => void;
}

function buildItems(
  target: PlayerListMenuTarget,
  local: PlayerListMenuLocal,
  buddyList: Props['buddyList'],
  ignoreList: Props['ignoreList'],
  moderationItems: ContextMenuItem[],
  actions: PlayerListMenuActions,
  t: TFunction,
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (target.deckHash) {
    items.push({
      label: t('PlayerListContextMenu.copyHash'),
      onClick: () => actions.onCopyHashToClipboard(target.deckHash),
    });
  }
  items.push({
    label: t('PlayerListContextMenu.userDetails'),
    onClick: () => actions.onOpenUserDetails(target.userName),
  });
  // Cockatrice disables Private chat when viewing yourself
  // (user_context_menu.cpp:376). We follow the same gate.
  items.push({
    label: t('PlayerListContextMenu.privateChat'),
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
      label: isBuddy ? t('PlayerListContextMenu.removeBuddy') : t('PlayerListContextMenu.addBuddy'),
      onClick: () => (isBuddy
        ? actions.onRemoveBuddy(target.userName)
        : actions.onAddBuddy(target.userName)),
    });
    const isIgnored = !!ignoreList[target.userName];
    items.push({
      label: isIgnored ? t('PlayerListContextMenu.removeIgnore') : t('PlayerListContextMenu.addIgnore'),
      onClick: () => (isIgnored
        ? actions.onRemoveIgnore(target.userName)
        : actions.onAddIgnore(target.userName)),
    });
  }

  if (local.canReport && actions.onReportUser) {
    const onReportUser = actions.onReportUser;
    items.push({ divider: true });
    items.push({
      label: t('ReportUserDialog.menuItem'),
      onClick: () => onReportUser(target.userName),
      disabled: target.isSelf,
    });
  }

  if (!target.isSelf && (local.isHost || local.isModerator)) {
    items.push({ divider: true });
    items.push({
      label: t('PlayerListContextMenu.kick'),
      onClick: () => actions.onKickFromGame(target.userName),
    });
  }

  items.push(...moderationItems);

  return items;
}

function PlayerListContextMenu({
  anchor,
  triggerRef,
  target,
  local,
  buddyList,
  ignoreList,
  moderationItems,
  actions,
  onDismiss,
}: Props) {
  const { t } = useTranslation();
  if (anchor == null || target == null) {
    return null;
  }
  const items = buildItems(target, local, buddyList, ignoreList, moderationItems, actions, t);
  return (
    <Menu
      anchor={anchor}
      label={t('PlayerListContextMenu.label', { name: target.userName })}
      onClose={onDismiss}
      triggerRef={triggerRef}
    >
      <div className="px-3 py-1.5 text-sm font-semibold text-text-primary truncate" aria-hidden>
        {target.userName}
      </div>
      <MenuSeparator />
      <ContextMenuEntries items={items} />
    </Menu>
  );
}

export default memo(PlayerListContextMenu);
