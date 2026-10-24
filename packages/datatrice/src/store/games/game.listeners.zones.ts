import { ZoneName } from '@cockatrice/sockatrice';
import { create } from '@bufbuild/protobuf';
import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { Event_DeleteArrowSchema } from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import {
  arrowsTouchingCard,
  buildMovedCard,
  cardMovedLogEntry,
  planAttachmentReparent,
  planMovePlacement,
  planOptimisticReconcile,
  planZoneViewSync,
  resolveMoveIdentity,
  sweepsArrows,
} from './cardMove';
import { consumeOptimistic, moveOpKey } from './optimistic';
import { formatCardPeeked, formatCardsDrawn, formatCardsRevealed } from './messageLog';

export function registerZonesListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
    actionCreator: Actions.cardMoved,
    effect: (action, api) => {
      const { gameId, playerId, data, isUndoDraw = false } = action.payload;
      const { startPlayerId, startZone, targetPlayerId, position, x } = data;

      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const sourceZone = game?.players[startPlayerId]?.zones[startZone];
      const targetZoneEntry = game?.players[targetPlayerId]?.zones[data.targetZone || startZone];
      if (!game || !sourceZone || !targetZoneEntry) {
        return;
      }

      const move = resolveMoveIdentity(sourceZone, data);
      const { targetZone } = move;
      const placement = planMovePlacement(move, sourceZone, data);

      if (placement === 'view-reorder') {
        api.dispatch(Actions.zoneViewCardReordered({
          gameId, playerId: startPlayerId, zoneName: startZone, fromPosition: position, toPosition: x,
        }));
      }
      if (move.hidden) {
        // A hidden card has no Server_Card to log by name, so only the counts (or the
        // open view) change. Undo-draw still logs: "X undoes their last draw" needs no
        // name, and an opponent's hand → deck is hidden on both ends. A reorder inside an
        // open view stays unlogged ("moves a card" would add nothing).
        // See datatrice-game.instructions.md#servatrice-game-event-quirks.
        if (placement === 'count-transfer') {
          api.dispatch(Actions.zoneCardCountAdjusted({ gameId, playerId: startPlayerId, zoneName: startZone, delta: -1 }));
          api.dispatch(Actions.zoneCardCountAdjusted({ gameId, playerId: targetPlayerId, zoneName: targetZone, delta: 1 }));
        }
        const message = isUndoDraw && placement !== 'view-reorder'
          ? cardMovedLogEntry(game, playerId, data, move, true)
          : null;
        if (message) {
          api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
        }
        return;
      }

      const movedCard = buildMovedCard(move, data);
      const viewSync = planZoneViewSync(move, sourceZone, targetZoneEntry, data);
      const optimisticKey = moveOpKey(startPlayerId, move.cardId);

      if (placement === 'same-zone') {
        consumeOptimistic(optimisticKey);
        api.dispatch(Actions.cardMovedInSameZone({
          gameId, playerId: startPlayerId, zoneName: startZone, cardId: move.cardId, toIndex: x, card: movedCard,
        }));
      } else if (placement === 'between-zones') {
        const confirmsOptimistic = move.cardId >= 0 && consumeOptimistic(optimisticKey);
        if (!confirmsOptimistic) {
          api.dispatch(Actions.cardMovedBetweenZones({
            gameId,
            fromPlayerId: startPlayerId,
            fromZone: startZone,
            fromCardId: move.cardId,
            toPlayerId: targetPlayerId,
            toZone: targetZone,
            card: movedCard,
          }));
        } else {
          const postDispatch = api.getState() as { games: GamesState };
          const reconcile = planOptimisticReconcile(
            postDispatch.games.games[gameId]?.players[targetPlayerId]?.zones[targetZone],
            move.cardId,
            movedCard,
          );
          if (reconcile?.kind === 'migrate') {
            api.dispatch(Actions.cardRemovedFromZone({
              gameId, playerId: targetPlayerId, zoneName: targetZone, cardId: move.cardId,
            }));
            api.dispatch(Actions.cardInsertedIntoZone({
              gameId, playerId: targetPlayerId, zoneName: targetZone, card: reconcile.card,
            }));
          } else if (reconcile?.kind === 'patch') {
            api.dispatch(Actions.cardFieldsUpdated({
              gameId, playerId: targetPlayerId, zoneName: targetZone, cardId: movedCard.id, fields: reconcile.fields,
            }));
          }
        }
      }

      if (viewSync.removeAt !== undefined) {
        api.dispatch(Actions.zoneViewCardRemoved({
          gameId, playerId: startPlayerId, zoneName: startZone, position: viewSync.removeAt,
        }));
      }
      if (viewSync.clearTop) {
        api.dispatch(Actions.topRevealedCardCleared({ gameId, playerId: startPlayerId, zoneName: startZone }));
      }
      if (viewSync.insertAt !== undefined) {
        api.dispatch(Actions.zoneViewCardInserted({
          gameId, playerId: targetPlayerId, zoneName: targetZone, position: viewSync.insertAt, card: movedCard,
        }));
      }

      if (sweepsArrows(move)) {
        const postMove = api.getState() as { games: GamesState };
        for (const { ownerPlayerId, arrowId } of arrowsTouchingCard(
          postMove.games, gameId, startPlayerId, startZone, move.cardId,
        )) {
          api.dispatch(Actions.arrowDeleted({
            gameId, playerId: ownerPlayerId, data: create(Event_DeleteArrowSchema, { arrowId }),
          }));
        }
      }

      const reparent = planAttachmentReparent(move, data);
      if (reparent) {
        api.dispatch(Actions.cardAttachmentReparented({ gameId, ...reparent }));
      }

      const message = cardMovedLogEntry(game, playerId, data, move, isUndoDraw);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardsDrawn,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { number: drawCount, cards } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const player = game?.players[playerId];
      const handZone = player?.zones[ZoneName.HAND];
      if (!game || !player || !handZone) {
        return;
      }

      if (player.zones[ZoneName.DECK]) {
        api.dispatch(Actions.zoneCardCountAdjusted({
          gameId, playerId, zoneName: ZoneName.DECK, delta: -drawCount,
        }));
        // Draw removes the top card — the previously-revealed face on
        // the pile is now stale. If auto-reveal is still on, Servatrice
        // re-emits Event_RevealCards immediately after this event (via
        // revealTopCardIfNeeded, server_abstract_player.cpp:329-333)
        // and the cardsRevealed reducer will re-populate topRevealedCard
        // with the new top. If auto-reveal is off, nothing follows and
        // the pile stays cleared — matches Cockatrice's "keep face on
        // toggle-off until top changes" behavior.
        api.dispatch(Actions.topRevealedCardCleared({
          gameId, playerId, zoneName: ZoneName.DECK,
        }));
      }

      for (const card of cards) {
        api.dispatch(Actions.cardInsertedIntoZone({
          gameId, playerId, zoneName: ZoneName.HAND, card,
        }));
      }

      // Opponent draws: bump cardCount for hidden slots.
      // See .github/instructions/datatrice-game.instructions.md#servatrice-game-event-quirks.
      if (drawCount > cards.length) {
        api.dispatch(Actions.zoneCardCountAdjusted({
          gameId, playerId, zoneName: ZoneName.HAND,
          delta: drawCount - cards.length,
        }));
      }

      // Draw beacon: scoped to real Event_DrawCards so a draw animation only fires
      // for Command_DrawCards / Command_Mulligan, not zone→hand drags or reveal-to-hand.
      api.dispatch(Actions.drawBeaconBumped({ gameId, playerId, count: drawCount }));

      api.dispatch(Actions.gameMessageAppended({
        gameId, playerId, message: formatCardsDrawn(game, playerId, drawCount),
      }));
    },
  });

  mw.startListening({
    actionCreator: Actions.cardsRevealed,
    effect: (action, api) => {
      const { gameId, playerId, data, replayOptions } = action.payload;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      if (!game) {
        return;
      }

      // Detect Servatrice's auto-reveal from revealTopCardIfNeeded up
      // front — both the chat log and the receiver dialog want to
      // suppress those. Both auto-reveals AND cmdRevealCards "top
      // N=1" emit `cards.length === 1` with `card_id === [0]`, so
      // the only reliable signal is the zone flag already being on
      // in state. Order is safe: Cockatrice enqueues
      // Event_ChangeZoneProperties BEFORE the auto-reveal event
      // (server_player.cpp:576-583), so the flag is up-to-date by
      // the time this listener runs.
      const zone = game.players[playerId]?.zones[data.zoneName];
      const isAutoTopReveal =
        data.cards.length === 1 &&
        (zone?.alwaysRevealTopCard || zone?.alwaysLookAtTopCard);

      // Chat log fires for EVERY recipient (source, target, spectators),
      // EXCEPT for auto-reveals — those are already announced via the
      // zonePropertiesChanged log ("SonicBliss is now revealing the top
      // card of their library") and re-logging every top-card change
      // would spam the chat on every draw.
      if (!isAutoTopReveal) {
        const message = formatCardsRevealed(game, playerId, data);
        if (message) {
          api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
        }
      }

      // Popup the receiver dialog only when we (the recipient) actually
      // got the face-up card list. Spectator-side Event_RevealCards has
      // an empty `cards[]` (server sends the summary via eventOthers)
      // — nothing to display for those.
      if (!data.cards || data.cards.length === 0) {
        return;
      }
      // Auto-reveals render on the pile via zone.topRevealedCard (set
      // by the cardsRevealed reducer's isAutoTopReveal branch), not
      // via the popup — matches Cockatrice's desktop UX.
      if (isAutoTopReveal) {
        return;
      }
      // Peek reveals — any card in the payload flagged `faceDown` means
      // the server is answering an `actPeek` (a hidden card on the
      // battlefield or in an opponent's zone that the source revealed
      // to itself). Cockatrice suppresses the receiver dialog for peeks
      // (player_event_handler.cpp:474-484) and emits one log line per
      // peeked card instead. The general `formatCardsRevealed` above
      // returns null for the peek branch (comment on that function),
      // so we emit peek logs here per-card, then return before the
      // popup dispatch.
      const isPeek = data.cards.some((c) => c.faceDown);
      if (isPeek) {
        for (const card of data.cards) {
          if (!card.faceDown) {
            continue;
          }
          const peekMessage = formatCardPeeked(game, playerId, card.id, card.name);
          api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message: peekMessage }));
        }
        return;
      }
      // Also seed the source's zone.revealedCards on OUR client, so the
      // existing zoneViewCardRemoved / zoneViewCardReordered auto-prune
      // paths keep the reveal snapshot in sync when we (or anyone) move
      // cards out of the source zone. Without this, a lend recipient
      // could "Move to my hand" a card from the lender's deck and the
      // dialog would still show it. isReversed=false because
      // Event_RevealCards doesn't carry the reveal direction — reveals
      // are always top-first (server iterates cards[] in list order at
      // server_abstract_player.cpp:1532).
      api.dispatch(Actions.zoneViewRevealed({
        gameId,
        playerId,
        zoneName: data.zoneName,
        cards: data.cards,
        isReversed: false,
      }));
      if (game.replay && replayOptions?.skipRevealWindow) {
        return;
      }
      api.dispatch(Actions.incomingRevealShown({
        gameId,
        sourceOwnerId: playerId,
        zoneName: data.zoneName,
        cards: data.cards,
        grantWriteAccess: data.grantWriteAccess,
      }));
    },
  });
}
