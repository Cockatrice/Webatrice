
import type { TFunction } from 'i18next';

import type { ContextMenuItem, MenuShortcutFor } from '../ContextMenu/ContextMenu';

export type HandCardMoveTarget = 'libraryTop' | 'libraryXFromTop' | 'libraryBottom' | 'table' | 'hand' | 'grave' | 'exile';

export interface BuildHandOrZoneCardMenuArgs {
  t: TFunction;
  menuShortcut: MenuShortcutFor;
  source: 'hand' | 'zoneView';
  canModify: boolean;
  revealTargets: readonly { playerId: number; name: string }[];
  onPlay: () => void;
  onPlayFaceDown: () => void;
  onReveal: (targetPlayerId: number) => void;
  onClone: () => void;
  onMove: (target: HandCardMoveTarget) => void;
  onDrawArrow: () => void;
  onSelectAll: () => void;
  onSelectColumn?: () => void;
  relatedViewItems?: ContextMenuItem[];
  tokenItems?: ContextMenuItem[];
}

export function buildHandOrZoneCardMenu(args: BuildHandOrZoneCardMenuArgs): ContextMenuItem[] {
  const hints = args.menuShortcut;
  const inHand = args.source === 'hand';
  const related = args.relatedViewItems ?? [];
  const tokens = inHand && args.tokenItems && args.tokenItems.length > 0
    ? [{ divider: true } as ContextMenuItem, ...args.tokenItems]
    : [];
  const selectAll: ContextMenuItem = {
    label: args.t('CardMenu.selectAll'),
    ...hints('game.selectAllBattlefield'),
    onClick: args.onSelectAll,
  };

  if (!args.canModify) {
    return [
      { label: args.t('CardMenu.drawArrow'), ...hints('game.drawArrow'), onClick: args.onDrawArrow },
      { divider: true },
      { label: args.t('CardMenu.clone'), ...hints('game.cloneCard'), onClick: args.onClone },
      { divider: true },
      selectAll,
      ...related,
      ...tokens,
    ];
  }

  return [
    { label: args.t('CardMenu.play'), ...hints('game.playCard'), onClick: args.onPlay },
    { label: args.t('CardMenu.playFaceDown'), ...hints('game.playCardFaceDown'), onClick: args.onPlayFaceDown },
    {
      label: args.t('CardMenu.revealTo'),
      submenu: [
        { label: args.t('CardMenu.allPlayers'), ...hints('game.revealSelectedToAll'), onClick: () => args.onReveal(-1) },
        { divider: true },
        ...args.revealTargets.map((t) => ({ label: t.name, onClick: () => args.onReveal(t.playerId) })),
      ],
    },
    { divider: true },
    { label: args.t('CardMenu.clone'), ...hints('game.cloneCard'), onClick: args.onClone },
    {
      label: args.t('CardMenu.moveTo'),
      submenu: [
        {
          label: args.t('CardMenu.topLibraryRandom'),
          ...hints('game.moveSelectedToLibraryTop'),
          onClick: () => args.onMove('libraryTop'),
        },
        { label: args.t('CardMenu.xFromTop'), onClick: () => args.onMove('libraryXFromTop') },
        {
          label: args.t('CardMenu.bottomLibraryRandom'),
          ...hints('game.moveSelectedToLibraryBottom'),
          onClick: () => args.onMove('libraryBottom'),
        },
        { divider: true },
        { label: args.t('CardMenu.table'), ...hints('game.moveSelectedToBattlefield'), onClick: () => args.onMove('table') },
        { divider: true },
        { label: args.t('ZoneLabel.title.hand'), ...hints('game.moveSelectedToHand'), onClick: () => args.onMove('hand') },
        { divider: true },
        { label: args.t('ZoneLabel.title.grave'), ...hints('game.moveSelectedToGrave'), onClick: () => args.onMove('grave') },
        { divider: true },
        { label: args.t('ZoneLabel.title.rfg'), ...hints('game.moveSelectedToExile'), onClick: () => args.onMove('exile') },
      ],
    },
    ...(inHand
      ? [
        { divider: true } as ContextMenuItem,
        { label: args.t('CardMenu.drawArrow'), ...hints('game.drawArrow'), onClick: args.onDrawArrow },
      ]
      : []),
    { divider: true },
    selectAll,
    ...(args.onSelectColumn
      ? [{ label: args.t('CardMenu.selectColumn'), ...hints('game.selectColumnBattlefield'), onClick: args.onSelectColumn }]
      : []),
    ...related,
    ...tokens,
  ];
}
