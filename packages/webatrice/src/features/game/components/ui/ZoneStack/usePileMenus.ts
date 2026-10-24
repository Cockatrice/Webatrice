import { ZoneName, type ZoneNameValue } from '@cockatrice/sockatrice';
import { useTranslation } from 'react-i18next';

import type { ContextMenuItem, MenuShortcutFor } from '../../context-menus/ContextMenu/ContextMenu';
import { useGameDialogsContext } from '../GameDialogsContext';
import type { PlayerCardViewModel, PlayerZoneCommands, SeatMoveDestination } from '../PlayerBoard/playerBoard.types';
import { toRecipient } from '../PlayerBoard/revealRecipient';

export interface UsePileMenusArgs {
  seatId: number;
  revealTargets: readonly { playerId: number; name: string }[];
  graveDisplayList: readonly PlayerCardViewModel[];
  exileDisplayList: readonly PlayerCardViewModel[];
  displayedGraveyardCount: number;
  displayedExileCount: number;
  menuShortcut: MenuShortcutFor;
  zoneCommands: PlayerZoneCommands;
}

export function usePileMenus({
  seatId,
  revealTargets,
  graveDisplayList,
  exileDisplayList,
  displayedGraveyardCount,
  displayedExileCount,
  menuShortcut,
  zoneCommands,
}: UsePileMenusArgs) {
  const { t } = useTranslation();
  const { openZoneView } = useGameDialogsContext();

  // Shared pile-menu item arrays. Cockatrice's PlayerMenu shows the
  // full grave / exile / library menus as nested submenus of the
  // battlefield right-click; the same menus also live on each pile's
  // own right-click. Extracting to shared arrays keeps the two entry
  // points in lockstep — any change to a pile menu automatically
  // flows through to the battlefield submenu.
  //
  // Helper for the "Move <pile> to <target>" bulk-move click handlers
  // that grave/exile menus both use — enumerates every card in the
  // source pile (in stored bottom→top order, matching desktop) into a
  // single Command_MoveCard.
  const buildMoveAll = (
    source: 'graveyard' | 'exile',
    list: readonly PlayerCardViewModel[],
    startZone: ZoneNameValue,
    targetZone: ZoneNameValue,
    index: SeatMoveDestination['index'],
  ): (() => void) => () => {
    if (list.length === 0) {
      return;
    }
    const cardIds = list.map((c) => Number(c.id)).filter((id) => Number.isFinite(id));
    if (cardIds.length === 0) {
      return;
    }
    // `source` param is intentionally unused inside the wire (startZone
    // carries the wire name); it's a documentation hint for the caller.
    void source;
    zoneCommands.moveCards(startZone, cardIds, { zone: targetZone, index });
  };
  // "Reveal random card to..." submenu — used by grave. Same shape as
  // reveal-library: All players (playerId=-1) + separator + one row
  // per opponent. Disabled when the source pile is empty (Servatrice
  // returns RespContextError on empty-zone random reveals,
  // server_abstract_player.cpp:1504).
  const buildRevealRandomSubmenu = (
    zoneName: ZoneNameValue,
    zoneSize: number,
  ): ContextMenuItem[] =>
    revealTargets && revealTargets.length > 0
      ? [
        {
          label: t('CardMenu.allPlayers'),
          onClick: () => zoneCommands.reveal(zoneName, toRecipient(-1), 'random'),
          disabled: zoneSize <= 0,
        },
        { divider: true },
        ...revealTargets.map((t) => ({
          label: t.name,
          onClick: () => zoneCommands.reveal(zoneName, toRecipient(t.playerId), 'random'),
          disabled: zoneSize <= 0,
        })),
      ]
      : [{ label: t('ZoneMenu.noPlayers') }];
  // Graveyard menu items — ported 1:1 from Cockatrice's GraveyardMenu
  // (grave_menu.cpp:14-36). Full self-view; opponent-view uses just
  // the "View graveyard" item below.
  const graveMenuItemsSelf: ContextMenuItem[] = [
    {
      label: t('ShortcutsTab.action.game.viewGraveyard'),
      onClick: () => openZoneView({ playerId: seatId, zoneName: ZoneName.GRAVE }),
      ...menuShortcut('game.viewGraveyard'),
    },
    {
      label: t('ZoneMenu.revealRandom'),
      disabled: displayedGraveyardCount <= 0,
      submenu: buildRevealRandomSubmenu(ZoneName.GRAVE, displayedGraveyardCount),
    },
    { divider: true },
    {
      // "Move graveyard to..." — bulk move mirrors PileZoneLogic::moveAllToZone
      // (card_zone_logic.cpp:134-153).
      label: t('ZoneMenu.moveGraveyard'),
      disabled: displayedGraveyardCount <= 0,
      submenu: [
        {
          label: t('HandMenu.topLibrary'),
          onClick: buildMoveAll('graveyard', graveDisplayList, ZoneName.GRAVE, ZoneName.DECK, 0),
          disabled: displayedGraveyardCount <= 0,
        },
        {
          label: t('HandMenu.bottomLibrary'),
          onClick: buildMoveAll('graveyard', graveDisplayList, ZoneName.GRAVE, ZoneName.DECK, 'end'),
          disabled: displayedGraveyardCount <= 0,
        },
        { divider: true },
        {
          label: t('ZoneLabel.title.hand'),
          onClick: buildMoveAll('graveyard', graveDisplayList, ZoneName.GRAVE, ZoneName.HAND, 0),
          disabled: displayedGraveyardCount <= 0,
        },
        { divider: true },
        {
          label: t('ZoneLabel.title.rfg'),
          onClick: buildMoveAll('graveyard', graveDisplayList, ZoneName.GRAVE, ZoneName.EXILE, 0),
          disabled: displayedGraveyardCount <= 0,
        },
      ],
    },
  ];
  const graveMenuItemsOpponent: ContextMenuItem[] = [
    {
      label: t('ShortcutsTab.action.game.viewGraveyard'),
      onClick: () => openZoneView({ playerId: seatId, zoneName: ZoneName.GRAVE }),
      disabled: displayedGraveyardCount <= 0,
    },
  ];
  // Exile menu items — ported 1:1 from Cockatrice's RfgMenu
  // (rfg_menu.cpp:9-28). Two deliberate omissions vs GraveyardMenu:
  // no "Reveal random card to..." submenu, and Move exile to... ends
  // at "Graveyard" (not a self "Exile" target).
  const exileMenuItemsSelf: ContextMenuItem[] = [
    {
      label: t('ZoneMenu.viewExile'),
      onClick: () => openZoneView({ playerId: seatId, zoneName: ZoneName.EXILE }),
      ...menuShortcut('game.viewExile'),
    },
    { divider: true },
    {
      label: t('ZoneMenu.moveExile'),
      disabled: displayedExileCount <= 0,
      submenu: [
        {
          label: t('HandMenu.topLibrary'),
          onClick: buildMoveAll('exile', exileDisplayList, ZoneName.EXILE, ZoneName.DECK, 0),
          disabled: displayedExileCount <= 0,
        },
        {
          label: t('HandMenu.bottomLibrary'),
          onClick: buildMoveAll('exile', exileDisplayList, ZoneName.EXILE, ZoneName.DECK, 'end'),
          disabled: displayedExileCount <= 0,
        },
        { divider: true },
        {
          label: t('ZoneLabel.title.hand'),
          onClick: buildMoveAll('exile', exileDisplayList, ZoneName.EXILE, ZoneName.HAND, 0),
          disabled: displayedExileCount <= 0,
        },
        { divider: true },
        {
          label: t('ZoneLabel.title.grave'),
          onClick: buildMoveAll('exile', exileDisplayList, ZoneName.EXILE, ZoneName.GRAVE, 0),
          disabled: displayedExileCount <= 0,
        },
      ],
    },
  ];
  const exileMenuItemsOpponent: ContextMenuItem[] = [
    {
      label: t('ZoneMenu.viewExile'),
      onClick: () => openZoneView({ playerId: seatId, zoneName: ZoneName.EXILE }),
      disabled: displayedExileCount <= 0,
    },
  ];

  return {
    graveMenuItemsSelf,
    graveMenuItemsOpponent,
    exileMenuItemsSelf,
    exileMenuItemsOpponent,
  };
}
