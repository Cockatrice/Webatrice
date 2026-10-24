import type { MenuShortcut } from '@app/feature-widgets/shortcuts';
import type { TFunction } from 'i18next';

import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import type { RevealRecipient } from './playerBoard.types';

export const ALL_PLAYERS = -1;

export const toRecipient = (targetPlayerId: number): RevealRecipient =>
  (targetPlayerId === ALL_PLAYERS ? 'all' : targetPlayerId);

export function buildRevealToSubmenu(
  t: TFunction,
  revealTargets: readonly { playerId: number; name: string }[] | undefined,
  onPick: (targetPlayerId: number) => void,
  disabled = false,
  allPlayersShortcut?: MenuShortcut,
): ContextMenuItem[] {
  return [
    { label: t('CardMenu.allPlayers'), onClick: () => onPick(ALL_PLAYERS), disabled, ...allPlayersShortcut },
    { divider: true },
    ...(revealTargets ?? []).map((t) => ({
      label: t.name,
      onClick: () => onPick(t.playerId),
      disabled,
    })),
  ];
}
