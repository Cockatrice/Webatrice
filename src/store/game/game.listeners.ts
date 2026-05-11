import { App, Data } from '@app/types';
import { listenerMiddleware } from '../listenerMiddleware';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { buildEmptyCard } from './game.reducer.helpers';
import { formatCardMoved } from './messageLog';

listenerMiddleware.startListening({
  actionCreator: Actions.cardMoved,
  effect: (action, api) => {
    const { gameId, playerId, data } = action.payload;
    const {
      cardId, cardName, startPlayerId, startZone, position,
      targetPlayerId, targetZone, x, y, newCardId, faceDown, newCardProviderId,
    } = data;

    const effectiveTargetZone = targetZone || startZone;

    const state = api.getState() as { games: GamesState };
    const game = state.games.games[gameId];
    const sourceZone = game?.players[startPlayerId]?.zones[startZone];
    const targetZoneEntry = game?.players[targetPlayerId]?.zones[effectiveTargetZone];
    if (!game || !sourceZone || !targetZoneEntry) {
      return;
    }

    let resolvedCardId = -1;
    if (cardId >= 0) {
      resolvedCardId = cardId;
    } else if (position >= 0 && position < sourceZone.order.length) {
      resolvedCardId = sourceZone.order[position];
    }

    if (resolvedCardId < 0 && newCardId < 0) {
      return;
    }

    const removedCard: Data.ServerInfo_Card | undefined =
      resolvedCardId >= 0 ? sourceZone.byId[resolvedCardId] : undefined;
    const effectiveNewId =
      newCardId >= 0 ? newCardId : (removedCard?.id ?? resolvedCardId);

    const isLeavingBattlefield =
      startZone === App.ZoneName.TABLE && effectiveTargetZone !== App.ZoneName.TABLE;

    const movedCard: Data.ServerInfo_Card = removedCard
      ? {
        ...removedCard,
        id: effectiveNewId,
        name: cardName || removedCard.name,
        x, y, faceDown,
        providerId: newCardProviderId || removedCard.providerId,
        counterList: isLeavingBattlefield ? [] : [...removedCard.counterList],
      }
      : buildEmptyCard(effectiveNewId, cardName, x, y, faceDown, newCardProviderId ?? '');

    api.dispatch(Actions.cardMovedBetweenZones({
      gameId,
      fromPlayerId: startPlayerId,
      fromZone: startZone,
      fromCardId: resolvedCardId,
      toPlayerId: targetPlayerId,
      toZone: effectiveTargetZone,
      card: movedCard,
    }));

    if (
      resolvedCardId >= 0 &&
      startZone === App.ZoneName.TABLE &&
      effectiveTargetZone === App.ZoneName.TABLE
    ) {
      api.dispatch(Actions.cardAttachmentReparented({
        gameId,
        fromPlayerId: startPlayerId,
        fromCardId: resolvedCardId,
        toPlayerId: targetPlayerId,
        toCardId: effectiveNewId,
      }));
    }

    const message = formatCardMoved(
      game, playerId,
      { ...data, targetZone: effectiveTargetZone },
      { resolvedCardName: removedCard?.name ?? '' },
    );
    if (message) {
      api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
    }
  },
});

export {};
