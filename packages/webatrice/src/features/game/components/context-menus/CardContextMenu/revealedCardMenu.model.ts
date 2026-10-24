
import type { TFunction } from 'i18next';

import type { ContextMenuItem, MenuShortcutFor } from '../ContextMenu/ContextMenu';

export interface BuildRevealedCardMenuArgs {
  t: TFunction;
  menuShortcut: MenuShortcutFor;
  onHide: () => void;
  onClone: () => void;
  canClone?: boolean;
  onSelectAll: () => void;
  relatedViewItems?: ContextMenuItem[];
}

export function buildRevealedCardMenu(args: BuildRevealedCardMenuArgs): ContextMenuItem[] {
  return [
    { label: args.t('CardMenu.hide'), ...args.menuShortcut('game.hideRevealedCard'), onClick: args.onHide },
    { divider: true },
    {
      label: args.t('CardMenu.clone'), ...args.menuShortcut('game.cloneCard'),
      onClick: args.onClone, disabled: args.canClone === false,
    },
    { divider: true },
    { label: args.t('CardMenu.selectAll'), ...args.menuShortcut('game.selectAllBattlefield'), onClick: args.onSelectAll },
    ...(args.relatedViewItems ?? []),
  ];
}
