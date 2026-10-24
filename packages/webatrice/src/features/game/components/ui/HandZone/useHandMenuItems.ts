import { ZoneName, type ZoneNameValue } from '@cockatrice/sockatrice';
import type { useMenuShortcut } from '@app/feature-widgets/shortcuts';
import { useTranslation } from 'react-i18next';

import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import { useGameDialogsContext } from '../GameDialogsContext';
import type { SeatMoveDestination, HandZoneViewModel, PlayerZoneCommands } from '../PlayerBoard/playerBoard.types';
import { buildRevealToSubmenu, toRecipient } from '../PlayerBoard/revealRecipient';

export interface UseHandMenuItemsArgs {
  seatId: number;
  isSelf: boolean;
  hand: HandZoneViewModel;
  revealTargets: readonly { playerId: number; name: string }[];
  menuShortcut: ReturnType<typeof useMenuShortcut>;
  zoneCommands: PlayerZoneCommands;
}

export function useHandMenuItems({
  seatId,
  isSelf,
  hand,
  revealTargets,
  menuShortcut,
  zoneCommands,
}: UseHandMenuItemsArgs) {
  const { t } = useTranslation();
  const { openZoneView, handleRequestSortHandBy, handleRequestChooseMulligan } = useGameDialogsContext();

  // Prefer the server-broadcast count from `hand.cardCount`, which
  // is populated for BOTH self and opponents (HAND is a PrivateZone
  // but its cardCount is public). Falling back to `hand.cards.length`
  // as second choice would silently return 0 for opponents — their
  // hand.cards array is always empty because they don't ship the card
  // identities to us — so nullish-coalescing to it would leave the
  // badge stuck at 0.
  const handSize = hand.cardCount ?? hand.cards.length;
  const revealHandSubmenu = buildRevealToSubmenu(
    t,
    revealTargets,
    (targetPlayerId) => zoneCommands.reveal(ZoneName.HAND, toRecipient(targetPlayerId)),
    handSize <= 0,
    menuShortcut('game.revealHandToAll'),
  );
  const revealRandomHandSubmenu = buildRevealToSubmenu(
    t,
    revealTargets,
    (targetPlayerId) => zoneCommands.reveal(ZoneName.HAND, toRecipient(targetPlayerId), 'random'),
    handSize <= 0,
    menuShortcut('game.revealRandomHandCardToAll'),
  );
  // Helper: build a "move all cards from HAND to <target>" click
  // handler. Hand card ids are real numeric ids on the wire.
  const moveAllHandTo = (
    targetZone: ZoneNameValue,
    index: SeatMoveDestination['index'],
  ): (() => void) => () => {
    if (hand.cards.length === 0) {
      return;
    }
    const cardIds = hand.cards.map((c) => Number(c.id)).filter((id) => Number.isFinite(id));
    if (cardIds.length === 0) {
      return;
    }
    zoneCommands.moveCards(ZoneName.HAND, cardIds, { zone: targetZone, index });
  };
  const sortHandItems: ContextMenuItem[] = [
    {
      label: t('HandMenu.sortName'),
      onClick: () => handleRequestSortHandBy('name'),
      disabled: !isSelf || handSize <= 1,
      ...menuShortcut('game.sortHandByName'),
    },
    {
      label: t('HandMenu.sortType'),
      onClick: () => handleRequestSortHandBy('maintype'),
      disabled: !isSelf || handSize <= 1,
      ...menuShortcut('game.sortHandByType'),
    },
    {
      label: t('HandMenu.sortManaValue'),
      onClick: () => handleRequestSortHandBy('manacost'),
      disabled: !isSelf || handSize <= 1,
      ...menuShortcut('game.sortHandByManaValue'),
    },
  ];
  const handMenuItems: ContextMenuItem[] = [
    {
      // View hand — the same zone view as View library /
      // graveyard / exile (desktop aViewHand). Only offered
      // for the local player; opponents' hands are hidden and the
      // dialog would have nothing to show.
      label: t('HandMenu.view'),
      onClick: () => openZoneView({ playerId: seatId, zoneName: ZoneName.HAND }),
      disabled: !isSelf || handSize <= 0,
      ...menuShortcut('game.viewHand'),
    },
    {
      label: t('HandMenu.sort'),
      submenu: sortHandItems,
    },
    {
      label: t('HandMenu.reveal'),
      submenu: revealHandSubmenu,
    },
    {
      label: t('ZoneMenu.revealRandom'),
      submenu: revealRandomHandSubmenu,
    },
    { divider: true },
    {
      // Opens a numeric prompt (dialog layer), then fires
      // Command_Mulligan with the resolved hand size. Accepts
      // -handSize..handSize+deckSize (≤0 is relative — desktop
      // parity, see handleRequestChooseMulligan in useGameDialogs).
      label: t('HandMenu.mulliganChoose'),
      onClick: () => handleRequestChooseMulligan(),
      disabled: !isSelf,
    },
    {
      label: t('HandMenu.mulliganSame'),
      onClick: () => zoneCommands.mulligan(handSize),
      disabled: handSize <= 0,
      ...menuShortcut('game.mulliganSameSize'),
    },
    {
      label: t('HandMenu.mulliganMinusOne'),
      onClick: () => zoneCommands.mulligan(Math.max(1, handSize - 1)),
      disabled: handSize <= 1,
      ...menuShortcut('game.mulliganMinusOne'),
    },
    { divider: true },
    {
      label: t('HandMenu.move'),
      disabled: handSize <= 0,
      submenu: [
        {
          label: t('HandMenu.topLibrary'),
          onClick: moveAllHandTo(ZoneName.DECK, 0),
          disabled: handSize <= 0,
        },
        {
          label: t('HandMenu.bottomLibrary'),
          onClick: moveAllHandTo(ZoneName.DECK, 'end'),
          disabled: handSize <= 0,
        },
        { divider: true },
        {
          label: t('ZoneLabel.title.grave'),
          onClick: moveAllHandTo(ZoneName.GRAVE, 0),
          disabled: handSize <= 0,
        },
        { divider: true },
        {
          label: t('ZoneLabel.title.rfg'),
          onClick: moveAllHandTo(ZoneName.EXILE, 0),
          disabled: handSize <= 0,
        },
      ],
    },
  ];

  return {
    handSize,
    handMenuItems,
    sortHandItems,
    revealHandItems: revealHandSubmenu,
  };
}
