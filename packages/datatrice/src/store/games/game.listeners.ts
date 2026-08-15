import { ZoneName } from '@cockatrice/sockatrice';
import { create, isFieldSet } from '@bufbuild/protobuf';
import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import {
  CardAttribute,
  Event_DeleteArrowSchema,
  Event_GameStateChangedSchema,
  Event_SetCardAttrSchema,
  ServerInfo_Card,
  ServerInfo_CardCounter,
  ServerInfo_CardCounterSchema,
  ServerInfo_CardSchema,
} from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import {
  attrOpKey,
  consumeOptimistic,
  moveOpKey,
} from './optimistic';
import { cloneWith } from '../../common';
import { buildEmptyCard, formatLeaveMessage, normalizePlayers, resetCardState } from './game.reducer.helpers';
import {
  EVENT_PLAYER_ID_SYSTEM,
  diffPlayerProperties,
  formatActivePhaseSet,
  formatActivePlayerSet,
  formatArrowCreated,
  formatCardAttached,
  formatCardsRevealed,
  formatCardAttrChanged,
  formatCardAttrChangedBulk,
  formatCardCounterChanged,
  formatCardDestroyed,
  formatCardFlipped,
  formatCardMoved,
  formatCardsDrawn,
  formatCounterSet,
  formatGameStart,
  formatPlayerJoined,
  formatPropertyDiff,
  formatTokenCreated,
  formatTurnReversed,
} from './messageLog';

export function registerGameListeners(mw: ListenerMiddlewareInstance<unknown>): void {
  mw.startListening({
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

      // Whether this event actually relocates the card to a different (player, zone).
      // Drives the hidden-move count transfer, the same-zone reorder branch, and the
      // open-zone-view prune below — keep it single-sourced so they can't disagree.
      const movedAcrossZones =
        startPlayerId !== targetPlayerId || startZone !== effectiveTargetZone;

      let resolvedCardId = -1;
      if (cardId >= 0) {
        resolvedCardId = cardId;
      } else if (position >= 0 && position < sourceZone.order.length) {
        resolvedCardId = sourceZone.order[position];
      }

      if (resolvedCardId < 0 && newCardId < 0) {
        // Fully hidden card (e.g. an opponent's hand card returning to library during a
        // mulligan): identity is unknown, but a cross-zone move still shifts zone totals.
        // Adjust cardCount on both ends so hidden hand/library counts stay in sync. A
        // same-zone "move" of a hidden card is unrepresentable, so it's a no-op EXCEPT
        // when the client has a reveal snapshot on the source zone: Servatrice hides
        // card_id for a bottom-view drag because `sourceBeingLookedAt` only checks
        // positions 0..cardsBeingLookedAt-1 (server_cardzone.cpp:187-190), so a card
        // at deck position N (where N >= cardsBeingLookedAt) comes back with card_id=-1
        // even though we could see it in the reveal. `position` and `x` are still
        // valid, and the reveal snapshot already knows the card's identity — fall
        // through so zoneViewCardReordered can splice within the snapshot.
        // See datatrice-game.instructions.md#servatrice-game-event-quirks.
        const canReorderInReveal =
          !movedAcrossZones &&
          !!sourceZone.revealedCards &&
          position >= 0;
        if (!canReorderInReveal) {
          if (movedAcrossZones) {
            api.dispatch(Actions.zoneCardCountAdjusted({
              gameId, playerId: startPlayerId, zoneName: startZone, delta: -1,
            }));
            api.dispatch(Actions.zoneCardCountAdjusted({
              gameId, playerId: targetPlayerId, zoneName: effectiveTargetZone, delta: 1,
            }));
          }
          return;
        }
        // Hidden-card reveal-reorder path: dispatch the snapshot splice directly.
        // We don't have the card's Server_Card object, so we can't emit a chat-log
        // line here — the log formatter would render "moves a card" anyway
        // (name missing on the event). Skip the log and let the visual update
        // stand on its own.
        api.dispatch(Actions.zoneViewCardReordered({
          gameId,
          playerId: startPlayerId,
          zoneName: startZone,
          fromPosition: position,
          toPosition: x,
        }));
        return;
      }

      const removedCard: ServerInfo_Card | undefined =
      resolvedCardId >= 0 ? sourceZone.byId[resolvedCardId] : undefined;
      const effectiveNewId =
      newCardId >= 0 ? newCardId : (removedCard?.id ?? resolvedCardId);

      const isLeavingBattlefield =
      startZone === ZoneName.TABLE && effectiveTargetZone !== ZoneName.TABLE;

      const baseCard: ServerInfo_Card = removedCard
        ? cloneWith(ServerInfo_CardSchema, removedCard, {
          id: effectiveNewId,
          name: cardName || removedCard.name,
          x, y, faceDown,
          providerId: newCardProviderId || removedCard.providerId,
          counterList: [...removedCard.counterList],
        })
        : buildEmptyCard(effectiveNewId, cardName, x, y, faceDown, newCardProviderId ?? '');

      // Leaving the battlefield wipes transient card state (tapped, counters, etc.) to
      // mirror desktop Cockatrice's CardItem::resetState(); see resetCardState.
      const movedCard = isLeavingBattlefield ? resetCardState(baseCard) : baseCard;

      // Capture before the move dispatch: if an open zone-view (deck) snapshot
      // holds this zone, the moved card must be pruned from it (see below).
      const hadRevealedSnapshot = !!sourceZone.revealedCards;
      // Capture the target-side reveal state too — a cross-zone move INTO a
      // zone that's being viewed needs to splice the arriving card into
      // the snapshot at position `x`, so the dialog shows the new card
      // at the same slot the user dropped it into.
      const hadTargetRevealedSnapshot = !!targetZoneEntry.revealedCards;

      const isPositionalReorderZone =
        effectiveTargetZone === ZoneName.HAND ||
        effectiveTargetZone === ZoneName.STACK ||
        effectiveTargetZone === ZoneName.GRAVE ||
        effectiveTargetZone === ZoneName.EXILE;

      if (!movedAcrossZones && hadRevealedSnapshot && position >= 0) {
        api.dispatch(Actions.zoneViewCardReordered({
          gameId,
          playerId: startPlayerId,
          zoneName: startZone,
          fromPosition: position,
          toPosition: x,
        }));
      } else if (!movedAcrossZones && isPositionalReorderZone && resolvedCardId >= 0) {
        // Same-zone reorder is idempotent — re-splicing the card at
        // the same index no-ops — so an optimistic pre-dispatch is
        // safe to re-apply here. We still consume any pending marker
        // so the rollback bookkeeping stays tidy.
        consumeOptimistic(moveOpKey(startPlayerId, resolvedCardId));
        api.dispatch(Actions.cardMovedInSameZone({
          gameId,
          playerId: startPlayerId,
          zoneName: startZone,
          cardId: resolvedCardId,
          toIndex: x,
          card: movedCard,
        }));
      } else {
        // Cross-zone moves are NOT idempotent (cardCount drift +
        // duplicate order entries if re-applied). Skip the dispatch
        // when a matching optimistic op is pending — the client
        // already moved the card locally, and this event is just the
        // server confirming that move. `consumeOptimistic` returns
        // true when it removed a matching entry, which is our signal.
        const optimisticKey = moveOpKey(startPlayerId, resolvedCardId);
        const skipDispatch =
          resolvedCardId >= 0 && consumeOptimistic(optimisticKey);
        if (!skipDispatch) {
          api.dispatch(Actions.cardMovedBetweenZones({
            gameId,
            fromPlayerId: startPlayerId,
            fromZone: startZone,
            fromCardId: resolvedCardId,
            toPlayerId: targetPlayerId,
            toZone: effectiveTargetZone,
            card: movedCard,
          }));
        } else {
          // The card is already in the target zone (client did it
          // optimistically), but the server may have corrected the
          // position — most importantly, Servatrice bumps `x` to the
          // next free stack sub-slot (`col*3 + 1`, `+2`) when a
          // column already has a card at sub-slot 0. Without this
          // sync, every stacked card would paint at the same sub-slot.
          // We do a field-level patch (not the full move reducer) so
          // cardCount + order aren't touched a second time.
          const effectiveId = movedCard.id;
          const targetZoneState =
            state.games.games[gameId]?.players[targetPlayerId]?.zones[effectiveTargetZone];
          if (targetZoneState?.byId[effectiveId]) {
            api.dispatch(Actions.cardFieldsUpdated({
              gameId,
              playerId: targetPlayerId,
              zoneName: effectiveTargetZone,
              cardId: effectiveId,
              fields: { x: movedCard.x, y: movedCard.y, faceDown: movedCard.faceDown },
            }));
          }
        }
      }

      // Keep an open "View library" snapshot in sync: when a card leaves a zone
      // that's being viewed, drop it from revealedCards and re-index the rest,
      // mirroring Cockatrice's live view (ZoneViewZoneLogic::removeCard). The
      // snapshot is deck-only (HiddenZone), so the event's `position` is the
      // index to prune. Same-zone reorders don't move the card out, so skip.
      if (hadRevealedSnapshot && movedAcrossZones && position >= 0) {
        api.dispatch(Actions.zoneViewCardRemoved({
          gameId,
          playerId: startPlayerId,
          zoneName: startZone,
          position,
        }));
      }

      // Clear the pile's persistent top-card face when position 0 might have
      // changed on the source zone. Only clears when the moved card was
      // AT the top (position === 0) — moves from elsewhere in the deck
      // don't affect what shows on the pile. If auto-reveal is still on,
      // Servatrice's revealTopCardIfNeeded re-emits Event_RevealCards
      // right after this event (server_abstract_player.cpp:329-333) and
      // the cardsRevealed reducer re-populates topRevealedCard with the
      // new top; if it's off, the pile stays cleared.
      if (position === 0 && startZone === ZoneName.DECK) {
        api.dispatch(Actions.topRevealedCardCleared({
          gameId,
          playerId: startPlayerId,
          zoneName: startZone,
        }));
      }

      // Mirror: a cross-zone move INTO a zone that's being viewed
      // splices the arriving card into the snapshot at position `x` so
      // the dialog immediately shows it at the slot the user dropped
      // it into. The card payload is `movedCard`, which already has the
      // effective new id + face-down flag applied. Same-zone reorders
      // are handled by the zoneViewCardReordered branch above.
      if (hadTargetRevealedSnapshot && movedAcrossZones) {
        api.dispatch(Actions.zoneViewCardInserted({
          gameId,
          playerId: targetPlayerId,
          zoneName: effectiveTargetZone,
          position: x,
          card: movedCard,
        }));
      }

      // Servatrice discards arrows server-side when a card changes zones but
      // does not emit Event_DeleteArrow, so client-side state would otherwise
      // retain orphans that re-render if the card returns. Mirror the server
      // semantics by sweeping every player's arrows (arrows can cross players)
      // for any endpoint matching the pre-move (startPlayerId, startZone,
      // resolvedCardId). Intra-zone repositions (e.g. moving a card around the
      // battlefield) keep their arrows server-side, so skip the sweep there.
      if (resolvedCardId >= 0 && startZone !== effectiveTargetZone) {
        const postState = api.getState() as { games: GamesState };
        const postGame = postState.games.games[gameId];
        if (postGame) {
          for (const [ownerIdStr, owner] of Object.entries(postGame.players)) {
            const ownerId = Number(ownerIdStr);
            for (const arrow of Object.values(owner.arrows)) {
              const startMatch =
                arrow.startPlayerId === startPlayerId &&
                arrow.startZone === startZone &&
                arrow.startCardId === resolvedCardId;
              const targetMatch =
                arrow.targetPlayerId === startPlayerId &&
                arrow.targetZone === startZone &&
                arrow.targetCardId === resolvedCardId;
              if (startMatch || targetMatch) {
                api.dispatch(Actions.arrowDeleted({
                  gameId,
                  playerId: ownerId,
                  data: create(Event_DeleteArrowSchema, { arrowId: arrow.id }),
                }));
              }
            }
          }
        }
      }

      if (
        resolvedCardId >= 0 &&
      startZone === ZoneName.TABLE &&
      effectiveTargetZone === ZoneName.TABLE
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

  mw.startListening({
    actionCreator: Actions.gameStateChanged,
    effect: (action, api) => {
      const { gameId, data } = action.payload;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      if (!game) {
        return;
      }
      const wasStarted = game.started;

      if (data.playerList?.length > 0) {
      // gameStateChanged resync: carry prior userInfo forward.
      // See .github/instructions/datatrice-game.instructions.md#servatrice-game-event-quirks.
        const previous = game.players;
        const next = normalizePlayers(data.playerList);
        for (const idStr of Object.keys(next)) {
          const id = Number(idStr);
          const prevPlayer = previous[id];
          const prevUserInfo = prevPlayer?.properties.userInfo;
          if (prevUserInfo && !next[id].properties.userInfo) {
            next[id].properties.userInfo = prevUserInfo;
          }
          // Carry forward any open "View library" snapshot. revealedCards is a
          // transient, local-only overlay (the resync wire data never includes it),
          // so without this a mid-game resync — e.g. a spectator joining — would
          // collapse an open zone-view popup. Same spirit as the userInfo carry above.
          if (prevPlayer) {
            for (const zoneName of Object.keys(next[id].zones)) {
              const prevRevealed = prevPlayer.zones[zoneName]?.revealedCards;
              if (prevRevealed) {
                next[id].zones[zoneName].revealedCards = prevRevealed;
              }
            }
          }
        }
        const order = data.playerList.map((p) => p.properties.playerId);
        api.dispatch(Actions.gamePlayersReplaced({ gameId, players: next, order }));
      }

      // isFieldSet distinguishes "set" from "default"; see .github/instructions/datatrice-store.instructions.md#reducer-author-hazards.
      let nextStarted = wasStarted;
      const update: {
      gameId: number;
      gameStarted?: boolean;
      activePlayerId?: number;
      activePhase?: number;
      secondsElapsed?: number;
    } = { gameId };
      let hasUpdate = false;
      if (isFieldSet(data, Event_GameStateChangedSchema.field.gameStarted)) {
        update.gameStarted = data.gameStarted;
        nextStarted = data.gameStarted;
        hasUpdate = true;
      }
      if (isFieldSet(data, Event_GameStateChangedSchema.field.activePlayerId)) {
        update.activePlayerId = data.activePlayerId;
        hasUpdate = true;
      }
      if (isFieldSet(data, Event_GameStateChangedSchema.field.activePhase)) {
        update.activePhase = data.activePhase;
        hasUpdate = true;
      }
      if (isFieldSet(data, Event_GameStateChangedSchema.field.secondsElapsed)) {
        update.secondsElapsed = data.secondsElapsed;
        hasUpdate = true;
      }
      if (hasUpdate) {
        api.dispatch(Actions.gameInfoUpdated(update));
      }

      // Pre-mutation read for the wasStarted→started log edge. See .github/instructions/datatrice-game.instructions.md#listener-patterns.
      if (!wasStarted && nextStarted) {
        api.dispatch(Actions.gameMessageAppended({
          gameId,
          playerId: EVENT_PLAYER_ID_SYSTEM,
          message: formatGameStart(),
        }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardAttrChanged,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId, attribute, attrValue } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      if (!game) {
        return;
      }

      let fields: Partial<ServerInfo_Card> | undefined;
      switch (attribute as CardAttribute) {
        case CardAttribute.AttrTapped:
          fields = { tapped: attrValue === '1' }; break;
        case CardAttribute.AttrAttacking:
          fields = { attacking: attrValue === '1' }; break;
        case CardAttribute.AttrFaceDown:
          fields = { faceDown: attrValue === '1' }; break;
        case CardAttribute.AttrColor:
          fields = { color: attrValue }; break;
        case CardAttribute.AttrPT:
          fields = { pt: attrValue }; break;
        case CardAttribute.AttrAnnotation:
          fields = { annotation: attrValue }; break;
        case CardAttribute.AttrDoesntUntap:
          fields = { doesntUntap: attrValue === '1' }; break;
      }

      if (!isFieldSet(data, Event_SetCardAttrSchema.field.cardId)) {
        // Cockatrice bulk sentinel: server omits card_id when applying to every card in the zone.
        const zone = game.players[playerId]?.zones[zoneName];
        if (!zone) {
          return;
        }
        if (fields) {
          api.dispatch(Actions.cardFieldsUpdatedBulk({ gameId, playerId, zoneName, fields }));
        }
        const bulkMessage = formatCardAttrChangedBulk(game, playerId, data);
        if (bulkMessage) {
          api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message: bulkMessage }));
        }
        return;
      }

      const card = game.players[playerId]?.zones[zoneName]?.byId[cardId];
      if (!card) {
        return;
      }
      const cardName = card.name;

      if (fields) {
        // cardFieldsUpdated is idempotent (fresh clone-with, same
        // input = same output) so the optimistic pre-dispatch can be
        // re-applied here safely. Consume any pending marker so the
        // rollback map doesn't leak entries.
        consumeOptimistic(attrOpKey(playerId, cardId, attribute));
        api.dispatch(Actions.cardFieldsUpdated({ gameId, playerId, zoneName, cardId, fields }));
      }

      const message = formatCardAttrChanged(game, playerId, data, cardName);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardCounterChanged,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId, counterId, counterValue } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const card = game?.players[playerId]?.zones[zoneName]?.byId[cardId];
      if (!game || !card) {
        return;
      }
      const cardName = card.name;
      const previousValue = card.counterList.find(c => c.id === counterId)?.value ?? 0;

      let nextCounterList: ServerInfo_CardCounter[];
      if (counterValue <= 0) {
        nextCounterList = card.counterList.filter(c => c.id !== counterId);
      } else {
        const idx = card.counterList.findIndex(c => c.id === counterId);
        if (idx >= 0) {
          nextCounterList = card.counterList.map((c, i) =>
            i === idx ? { ...c, value: counterValue } : c,
          );
        } else {
          nextCounterList = [
            ...card.counterList,
            create(ServerInfo_CardCounterSchema, { id: counterId, value: counterValue }),
          ];
        }
      }
      api.dispatch(Actions.cardFieldsUpdated({
        gameId, playerId, zoneName, cardId, fields: { counterList: nextCounterList },
      }));

      const message = formatCardCounterChanged(game, playerId, data, cardName, previousValue);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardsRevealed,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      if (!game) return;

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
      if (!data.cards || data.cards.length === 0) return;
      // Auto-reveals render on the pile via zone.topRevealedCard (set
      // by the cardsRevealed reducer's isAutoTopReveal branch), not
      // via the popup — matches Cockatrice's desktop UX.
      if (isAutoTopReveal) return;
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
      api.dispatch(Actions.incomingRevealShown({
        gameId,
        sourceOwnerId: playerId,
        zoneName: data.zoneName,
        cards: data.cards,
        grantWriteAccess: data.grantWriteAccess,
      }));
    },
  });

  mw.startListening({
    actionCreator: Actions.cardAttached,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { startZone, cardId, targetPlayerId, targetZone, targetCardId } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const card = game?.players[playerId]?.zones[startZone]?.byId[cardId];
      if (!game || !card) {
        return;
      }
      const sourceCardName = card.name;

      // Unattach detected via empty targetZone; explicit sentinels.
      // See .github/instructions/datatrice-game.instructions.md#servatrice-game-event-quirks.
      const isUnattach = !targetZone;
      const fields: Partial<ServerInfo_Card> = isUnattach
        ? { attachPlayerId: -1, attachZone: '', attachCardId: -1 }
        : { attachPlayerId: targetPlayerId, attachZone: targetZone, attachCardId: targetCardId };
      api.dispatch(Actions.cardFieldsUpdated({
        gameId, playerId, zoneName: startZone, cardId, fields,
      }));

      const message = formatCardAttached(game, playerId, data, sourceCardName);
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
    actionCreator: Actions.playerPropertiesChanged,
    effect: (action, api) => {
      const { gameId, playerId, properties } = action.payload;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const player = game?.players[playerId];
      if (!game || !player) {
        return;
      }

      const previous = { ...player.properties };
      api.dispatch(Actions.playerPropertiesUpdated({ gameId, playerId, properties }));

      const nextState = api.getState() as { games: GamesState };
      const nextGame = nextState.games.games[gameId];
      const nextPlayer = nextGame?.players[playerId];
      if (!nextGame || !nextPlayer) {
        return;
      }
      const diff = diffPlayerProperties(previous, nextPlayer.properties);
      for (const message of formatPropertyDiff(nextGame, playerId, diff)) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardDestroyed,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const zone = game?.players[playerId]?.zones[zoneName];
      if (!game || !zone) {
        return;
      }
      // Pre-mutation read for log. See .github/instructions/datatrice-game.instructions.md#listener-patterns.
      const destroyedName = zone.byId[cardId]?.name;
      api.dispatch(Actions.cardRemovedFromZone({ gameId, playerId, zoneName, cardId }));

      const message = formatCardDestroyed(game, playerId, destroyedName);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.tokenCreated,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const {
        zoneName, cardId, cardName, color, pt, annotation,
        destroyOnZoneChange, x, y, cardProviderId, faceDown,
      } = data;
      const state = api.getState() as { games: GamesState };
      const game = state.games.games[gameId];
      const zone = game?.players[playerId]?.zones[zoneName];
      if (!game || !zone) {
        return;
      }
      // Construct the token via the protobuf-es schema constructor so any
      // fields the wire payload omitted (tapped / attacking / doesntUntap /
      // counterList / attach*) start at the protocol's documented defaults
      // rather than proto3's zero/empty surfacing. The attach* fields are
      // written as -1 / '' / -1 so downstream `isAttachedChild` recognises
      // the token as detached the moment it lands on the table.
      const newCard = create(ServerInfo_CardSchema, {
        id: cardId, name: cardName, x, y, faceDown,
        tapped: false, attacking: false, color, pt, annotation, destroyOnZoneChange,
        doesntUntap: false, counterList: [],
        attachPlayerId: -1, attachZone: '', attachCardId: -1, providerId: cardProviderId,
      });
      api.dispatch(Actions.cardInsertedIntoZone({ gameId, playerId, zoneName, card: newCard }));

      const message = formatTokenCreated(game, playerId, data);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.cardFlipped,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const { zoneName, cardId } = data;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      const preCard = preGame?.players[playerId]?.zones[zoneName]?.byId[cardId];
      if (!preGame || !preCard) {
        return;
      }
      const previousName = preCard.name;
      const message = formatCardFlipped(preGame, playerId, data, previousName);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.counterSet,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      const preCounter = preGame?.players[playerId]?.counters[data.counterId];
      if (!preGame || !preCounter) {
        return;
      }
      const previousValue = preCounter.count;
      const message = formatCounterSet(preGame, playerId, data, preCounter.name, previousValue);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.arrowCreated,
    effect: (action, api) => {
      const { gameId, playerId, data } = action.payload;
      if (!data.arrowInfo) {
        return;
      }
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      const prePlayer = preGame?.players[playerId];
      if (!preGame || !prePlayer) {
        return;
      }
      const message = formatArrowCreated(preGame, playerId, data.arrowInfo);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.activePlayerSet,
    effect: (action, api) => {
      const { gameId, activePlayerId } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      // Suppress the turn-change log before the game starts (the initial active-player
      // assignment moves from -1 during setup/resume) and when it didn't change —
      // matching activePhaseSet's `!preGame.started` guard.
      if (preGame.activePlayerId === activePlayerId || !preGame.started) {
        return;
      }
      const postState = api.getState() as { games: GamesState };
      const postGame = postState.games.games[gameId];
      if (!postGame) {
        return;
      }
      const message = formatActivePlayerSet(postGame, activePlayerId);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({ gameId, playerId: activePlayerId, message }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.activePhaseSet,
    effect: (action, api) => {
      const { gameId, phase } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      // Suppress the log on initial-phase replay (game not yet started) and
      // when the phase didn't actually change — matching the pre-refactor
      // reducer's `previous !== payload.phase && game.started` guard.
      if (preGame.activePhase === phase || !preGame.started) {
        return;
      }
      const message = formatActivePhaseSet(phase);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({
          gameId, playerId: EVENT_PLAYER_ID_SYSTEM, message,
        }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.turnReversed,
    effect: (action, api) => {
      const { gameId, reversed } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      const message = formatTurnReversed(preGame, preGame.activePlayerId, reversed);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({
          gameId, playerId: preGame.activePlayerId, message,
        }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.playerJoined,
    effect: (action, api) => {
      const { gameId, playerProperties } = action.payload;
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      const postState = api.getState() as { games: GamesState };
      const postGame = postState.games.games[gameId];
      if (!postGame) {
        return;
      }
      const message = formatPlayerJoined(postGame, playerProperties.playerId);
      if (message) {
        api.dispatch(Actions.gameMessageAppended({
          gameId, playerId: playerProperties.playerId, message,
        }));
      }
    },
  });

  mw.startListening({
    actionCreator: Actions.playerLeft,
    effect: (action, api) => {
      const { gameId, playerId, reason } = action.payload;
      // @critical Pre-mutation read; reducer deletes the player. See .github/instructions/datatrice-game.instructions.md#listener-patterns.
      const preState = api.getOriginalState() as { games: GamesState };
      const preGame = preState.games.games[gameId];
      if (!preGame) {
        return;
      }
      const playerName = preGame.players[playerId]?.properties.userInfo?.name ?? 'Unknown player';
      const message = formatLeaveMessage(playerName, reason);
      api.dispatch(Actions.gameMessageAppended({ gameId, playerId, message }));
    },
  });
}
