import { ZoneName } from '@cockatrice/sockatrice';
import { useTranslation } from 'react-i18next';

import type { ContextMenuItem, MenuShortcutFor } from '../../context-menus/ContextMenu/ContextMenu';
import { useGameDialogsContext } from '../GameDialogsContext';
import type { PlayerZoneCommands } from '../PlayerBoard/playerBoard.types';
import { buildRevealToSubmenu, toRecipient } from '../PlayerBoard/revealRecipient';
import type { LibraryOps } from '../PlayerBoard/useLibraryOps';
import type { useSeatPrompts } from '../PlayerBoard/useSeatPrompts';

type SeatPrompts = ReturnType<typeof useSeatPrompts>;

export interface UseLibraryMenuItemsArgs {
  seatId: number;
  deckCount: number;
  revealTargets: readonly { playerId: number; name: string }[];
  alwaysRevealTopCard: boolean;
  alwaysLookAtTopCard: boolean;
  draw: (n: number) => void;
  libraryOps: LibraryOps;
  openDrawCardsPrompt: SeatPrompts['openDrawCardsPrompt'];
  openViewLibraryCountPrompt: SeatPrompts['openViewLibraryCountPrompt'];
  openRevealTopCardsPrompt: SeatPrompts['openRevealTopCardsPrompt'];
  openMoveTopUntilDialog: () => void;
  onOpenDeckInEditor: (() => void) | undefined;
  menuShortcut: MenuShortcutFor;
  zoneCommands: PlayerZoneCommands;
}

export function useLibraryMenuItems({
  seatId,
  deckCount,
  revealTargets,
  alwaysRevealTopCard,
  alwaysLookAtTopCard,
  draw,
  libraryOps,
  openDrawCardsPrompt,
  openViewLibraryCountPrompt,
  openRevealTopCardsPrompt,
  openMoveTopUntilDialog,
  onOpenDeckInEditor,
  menuShortcut,
  zoneCommands,
}: UseLibraryMenuItemsArgs) {
  const { t } = useTranslation();
  const { openZoneView } = useGameDialogsContext();

  // Library menu items — ported 1:1 from Cockatrice's LibraryMenu.
  // Cockatrice attaches the SAME LibraryMenu instance to both the
  // library pile and the battlefield PlayerMenu (player_menu.cpp:23,67),
  // so the two entry points share this const. The top / bottom card
  // actions are the seat's library ops, which the shortcuts share.
  // "Reveal library to..." and "Reveal top cards to..." always list "All
  // players" first, even when playing alone (library_menu.cpp:259-267,
  // 295-303); the reveal-top-N variant opens a count prompt per pick. Lend
  // library lists only the other players (library_menu.cpp:280-293).
  const revealLibraryItems = buildRevealToSubmenu(
    t,
    revealTargets,
    (targetPlayerId) => zoneCommands.reveal(ZoneName.DECK, toRecipient(targetPlayerId)),
  );
  const lendLibraryItems: ContextMenuItem[] =
    revealTargets && revealTargets.length > 0
      ? revealTargets.map((t) => ({
        label: t.name,
        onClick: () => zoneCommands.lendLibrary(t.playerId),
      }))
      : [{ label: t('ZoneMenu.noPlayers') }];
  const revealTopCardsItems = buildRevealToSubmenu(t, revealTargets, (targetPlayerId) =>
    openRevealTopCardsPrompt({
      targetPlayerId,
      deckSize: deckCount,
    }));
  const topLibraryItems: ContextMenuItem[] = [
    {
      label: t('ShortcutsTab.action.game.playTop'),
      onClick: () => libraryOps.moveTopCard(ZoneName.STACK, 'end'),
      disabled: deckCount <= 0,
      ...menuShortcut('game.playTop'),
    },
    {
      label: t('ZoneMenu.playTopFaceDown'),
      onClick: () => libraryOps.moveTopCard(ZoneName.TABLE, 'end', true),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopToPlayFaceDown'),
    },
    {
      label: t('ZoneMenu.putTopOnBottom'),
      onClick: () => libraryOps.moveTopCard(ZoneName.DECK, 'end'),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopToBottom'),
    },
    { divider: true },
    {
      label: t('ShortcutsTab.action.game.moveTopToGrave'),
      onClick: () => libraryOps.moveTopCard(ZoneName.GRAVE, 0),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopToGrave'),
    },
    {
      label: t('ZoneMenu.moveTopNGrave'),
      onClick: () => libraryOps.promptMoveTopCards(ZoneName.GRAVE),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopNToGrave'),
    },
    {
      label: t('ZoneMenu.moveTopNGraveFaceDown'),
      onClick: () => libraryOps.promptMoveTopCards(ZoneName.GRAVE, true),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopNToGraveFaceDown'),
    },
    {
      label: t('ZoneMenu.moveTopExile'),
      onClick: () => libraryOps.moveTopCard(ZoneName.EXILE, 0),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopToExile'),
    },
    {
      label: t('ZoneMenu.moveTopNExile'),
      onClick: () => libraryOps.promptMoveTopCards(ZoneName.EXILE),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopNToExile'),
    },
    {
      label: t('ZoneMenu.moveTopNExileFaceDown'),
      onClick: () => libraryOps.promptMoveTopCards(ZoneName.EXILE, true),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopNToExileFaceDown'),
    },
    {
      label: t('ShortcutsTab.action.game.moveTopUntil'),
      onClick: openMoveTopUntilDialog,
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveTopUntil'),
    },
    { divider: true },
    {
      label: t('ZoneMenu.shuffleTop'),
      onClick: libraryOps.promptShuffleTopCards,
      disabled: deckCount <= 0,
      ...menuShortcut('game.shuffleTopCards'),
    },
  ];
  const bottomLibraryItems: ContextMenuItem[] = [
    {
      label: t('ZoneMenu.drawBottom'),
      onClick: () => libraryOps.moveBottomCard(ZoneName.HAND, 0),
      disabled: deckCount <= 0,
      ...menuShortcut('game.drawBottomCard'),
    },
    {
      label: t('ZoneMenu.drawBottomN'),
      onClick: () => libraryOps.promptMoveBottomCards(ZoneName.HAND),
      disabled: deckCount <= 0,
      ...menuShortcut('game.drawBottomCards'),
    },
    { divider: true },
    {
      label: t('ZoneMenu.playBottom'),
      onClick: () => libraryOps.moveBottomCard(ZoneName.STACK, 'end'),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomToPlay'),
    },
    {
      label: t('ZoneMenu.playBottomFaceDown'),
      onClick: () => libraryOps.moveBottomCard(ZoneName.TABLE, 'end', true),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomToPlayFaceDown'),
    },
    {
      label: t('ZoneMenu.putBottomOnTop'),
      onClick: () => libraryOps.moveBottomCard(ZoneName.DECK, 0),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomToTop'),
    },
    { divider: true },
    {
      label: t('ZoneMenu.moveBottomGrave'),
      onClick: () => libraryOps.moveBottomCard(ZoneName.GRAVE, 0),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomToGrave'),
    },
    {
      label: t('ZoneMenu.moveBottomNGrave'),
      onClick: () => libraryOps.promptMoveBottomCards(ZoneName.GRAVE),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomNToGrave'),
    },
    {
      label: t('ZoneMenu.moveBottomNGraveFaceDown'),
      onClick: () => libraryOps.promptMoveBottomCards(ZoneName.GRAVE, true),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomNToGraveFaceDown'),
    },
    {
      label: t('ZoneMenu.moveBottomExile'),
      onClick: () => libraryOps.moveBottomCard(ZoneName.EXILE, 0),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomToExile'),
    },
    {
      label: t('ZoneMenu.moveBottomNExile'),
      onClick: () => libraryOps.promptMoveBottomCards(ZoneName.EXILE),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomNToExile'),
    },
    {
      label: t('ZoneMenu.moveBottomNExileFaceDown'),
      onClick: () => libraryOps.promptMoveBottomCards(ZoneName.EXILE, true),
      disabled: deckCount <= 0,
      ...menuShortcut('game.moveBottomNToExileFaceDown'),
    },
    { divider: true },
    {
      label: t('ZoneMenu.shuffleBottom'),
      onClick: libraryOps.promptShuffleBottomCards,
      disabled: deckCount <= 0,
      ...menuShortcut('game.shuffleBottomCards'),
    },
  ];
  const libraryMenuItems: ContextMenuItem[] = [
    {
      label: t('ShortcutsTab.action.game.drawCard'),
      onClick: () => draw(1),
      disabled: deckCount <= 0,
      ...menuShortcut('game.drawCard'),
    },
    {
      label: t('ZoneMenu.drawCards'),
      onClick: () => openDrawCardsPrompt({ deckSize: deckCount }),
      disabled: deckCount <= 0,
      ...menuShortcut('game.drawMultipleCards'),
    },
    {
      label: t('ZoneMenu.undoDraw'),
      onClick: () => zoneCommands.undoDraw(),
      // Cockatrice always shows this enabled; server rejects when
      // nothing to undo.
      ...menuShortcut('game.undoDraw'),
    },
    { divider: true },
    {
      label: t('ZoneMenu.shuffle'),
      onClick: () => zoneCommands.shuffleLibrary(),
      disabled: deckCount <= 1,
      ...menuShortcut('game.shuffleLibrary'),
    },
    { divider: true },
    {
      label: t('ShortcutsTab.action.game.viewLibrary'),
      onClick: () => openZoneView({ playerId: seatId, zoneName: ZoneName.DECK }),
      disabled: deckCount <= 0,
      ...menuShortcut('game.viewLibrary'),
    },
    {
      label: t('ZoneMenu.viewTop'),
      onClick: () =>
        openViewLibraryCountPrompt({ isReversed: false, deckSize: deckCount }),
      disabled: deckCount <= 0,
      ...menuShortcut('game.viewTopCards'),
    },
    {
      label: t('ZoneMenu.viewBottom'),
      onClick: () =>
        openViewLibraryCountPrompt({ isReversed: true, deckSize: deckCount }),
      disabled: deckCount <= 0,
      ...menuShortcut('game.viewBottomCards'),
    },
    { divider: true },
    { label: t('ZoneMenu.revealLibrary'), submenu: revealLibraryItems },
    { label: t('ZoneMenu.lendLibrary'), submenu: lendLibraryItems },
    { label: t('ZoneMenu.revealTop'), submenu: revealTopCardsItems },
    {
      label: t('ZoneMenu.alwaysRevealTop'),
      checked: alwaysRevealTopCard ?? false,
      onClick: () => zoneCommands.setAlwaysRevealTopCard(!alwaysRevealTopCard),
      ...menuShortcut('game.alwaysRevealTopCard'),
    },
    {
      label: t('ZoneMenu.alwaysLookTop'),
      checked: alwaysLookAtTopCard ?? false,
      onClick: () => zoneCommands.setAlwaysLookAtTopCard(!alwaysLookAtTopCard),
      ...menuShortcut('game.alwaysLookAtTopCard'),
    },
    { divider: true },
    {
      label: t('ZoneMenu.topLibrary'),
      disabled: deckCount <= 0,
      submenu: topLibraryItems,
    },
    {
      label: t('ZoneMenu.bottomLibrary'),
      disabled: deckCount <= 0,
      submenu: bottomLibraryItems,
    },
    { divider: true },
    {
      label: t('ZoneMenu.openDeckEditor'),
      onClick: onOpenDeckInEditor,
      disabled: !onOpenDeckInEditor,
    },
  ];

  return {
    libraryMenuItems,
    topLibraryItems,
    bottomLibraryItems,
  };
}
