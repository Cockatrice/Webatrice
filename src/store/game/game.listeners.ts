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

    // Server omits target_zone when it equals start_zone (proto3 strips the
    // default empty string). Desktop's GameEventHandler applies the same
    // fallback; without it, intra-zone moves silently bail at the zone lookup.
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

    // Malformed event: no resolvable source AND no replacement id — bail
    // out to avoid creating phantom cards with id -1.
    if (resolvedCardId < 0 && newCardId < 0) {
      return;
    }

    const removedCard: Data.ServerInfo_Card | undefined =
      resolvedCardId >= 0 ? sourceZone.byId[resolvedCardId] : undefined;
    const effectiveNewId =
      newCardId >= 0 ? newCardId : (removedCard?.id ?? resolvedCardId);

    // Counters represent battlefield-only state in MTG; leaving the table
    // discards them. Mirrors Cockatrice's CardItem::resetState() which
    // clears `counters` on any zone transition out of play. Done client-side
    // because Servatrice does not always emit a zeroing cardCounterChanged
    // event on zone exit; this guard makes the divergence safe either way.
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

    // Pass the defaulted targetZone through so isSameZoneReorder in the
    // formatter correctly suppresses the log line for intra-zone reorders.
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
