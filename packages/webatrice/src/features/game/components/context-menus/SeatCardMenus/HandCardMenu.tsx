import { usePreference } from '@app/hooks';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { useCanActFor } from '../../ui/CardVisualStateContext';
import { EMPTY_CARD_KEYS } from '../../ui/GameSelectionContext';
import { usePlayerSeatContext } from '../../ui/PlayerBoard/PlayerSeatContext';
import { toRecipient } from '../../ui/PlayerBoard/revealRecipient';
import { resolveHandOrZoneCardMenu } from '../CardContextMenu/handCardMenu.actions';
import { buildRelatedTokenItems } from '../CardContextMenu/relatedCardActions';
import { ContextMenuPopup } from '../ContextMenu/ContextMenu';
import { useGameId } from '../../ui/GameIdContext';
import { isHiddenZone } from '../../../utils/zones';
import { revealedCardsToSeatCards, zoneToSeatCards } from '../../ui/GameBoardCell/usePlayerSeatViewModel';

export default function HandCardMenu() {
  const { t } = useTranslation();
  const playToStack = usePreference('playToStack');
  const {
    cardCommands,
    cardMetaByName,
    closeSeatCardMenu,
    deckCount,
    gameSelection,
    handCardMenu,
    handDisplayList,
    menuOwnerId,
    openMoveXFromTopPrompt,
    relatedViewItemsFor,
    revealTargets,
    selection,
    startDrawArrow,
    setSelection,
    menuShortcut,
    tokenMetaByName,
    zoneCommands,
    zoneViewCardMenu,
  } = usePlayerSeatContext();
  const annotateTokens = usePreference('annotateTokens');
  const canModify = useCanActFor()(menuOwnerId);
  const gameId = useGameId();
  const zone = useAppSelector((state) => gameId != null && zoneViewCardMenu
    ? games.Selectors.getZone(state, gameId, menuOwnerId, zoneViewCardMenu.zone)
    : undefined);
  const zoneViewCards = useMemo(
    () => isHiddenZone(zone) ? revealedCardsToSeatCards(zone?.revealedCards) : zoneToSeatCards(zone),
    [zone],
  );

  const menu = resolveHandOrZoneCardMenu({
    t,
    menu: handCardMenu ?? zoneViewCardMenu,
    ownerId: menuOwnerId,
    menuShortcut,
    canModify,
    revealTargets,
    handCards: handDisplayList,
    zoneViewCards,
    handSelection: selection,
    setHandSelection: setSelection,
    selectedCardKeys: gameSelection?.selectedCardKeys ?? EMPTY_CARD_KEYS,
    setSelectedCardKeys: (keys) => gameSelection?.setSelectedCardKeys(keys),
    cardMeta: (name) => cardMetaByName.get(name),
    deckSize: deckCount,
    playToStack,
    moveCards: zoneCommands.moveCards,
    revealCards: (zone, targetPlayerId, cardIds) => zoneCommands.reveal(zone, toRecipient(targetPlayerId), { cardIds }),
    cloneCard: cardCommands.clone,
    promptMoveXFromTop: openMoveXFromTopPrompt,
    startArrow: startDrawArrow,
    relatedViewItems: relatedViewItemsFor,
    tokenItems: (name) =>
      buildRelatedTokenItems(t, cardMetaByName.get(name)?.related ?? [], tokenMetaByName, cardCommands.createToken, annotateTokens),
    close: closeSeatCardMenu,
  });
  return menu && <ContextMenuPopup {...menu} onClose={closeSeatCardMenu} />;
}
