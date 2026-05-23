import { create, isFieldSet } from '@bufbuild/protobuf';
import type { ListenerMiddlewareInstance } from '@reduxjs/toolkit';

import { Enriched } from '../../types';
import {
  CardAttribute,
  Event_GameStateChangedSchema,
  ServerInfo_Card,
  ServerInfo_CardCounter,
  ServerInfo_CardCounterSchema,
  ServerInfo_CardSchema,
} from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';
import { Actions } from './game.actions';
import { buildEmptyCard, formatLeaveMessage, normalizePlayers } from './game.reducer.helpers';
import {
  EVENT_PLAYER_ID_SYSTEM,
  diffPlayerProperties,
  formatActivePhaseSet,
  formatActivePlayerSet,
  formatArrowCreated,
  formatCardAttached,
  formatCardAttrChanged,
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

      let resolvedCardId = -1;
      if (cardId >= 0) {
        resolvedCardId = cardId;
      } else if (position >= 0 && position < sourceZone.order.length) {
        resolvedCardId = sourceZone.order[position];
      }

      if (resolvedCardId < 0 && newCardId < 0) {
        return;
      }

      const removedCard: ServerInfo_Card | undefined =
      resolvedCardId >= 0 ? sourceZone.byId[resolvedCardId] : undefined;
      const effectiveNewId =
      newCardId >= 0 ? newCardId : (removedCard?.id ?? resolvedCardId);

      const isLeavingBattlefield =
      startZone === Enriched.ZoneName.TABLE && effectiveTargetZone !== Enriched.ZoneName.TABLE;

      const movedCard: ServerInfo_Card = removedCard
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
      startZone === Enriched.ZoneName.TABLE &&
      effectiveTargetZone === Enriched.ZoneName.TABLE
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
      // gameStateChanged resync: carry prior userInfo forward. See .github/instructions/datatrice-game.instructions.md#servatrice-game-event-quirks.
        const previous = game.players;
        const next = normalizePlayers(data.playerList);
        for (const idStr of Object.keys(next)) {
          const id = Number(idStr);
          const prevUserInfo = previous[id]?.properties.userInfo;
          if (prevUserInfo && !next[id].properties.userInfo) {
            next[id].properties.userInfo = prevUserInfo;
          }
        }
        api.dispatch(Actions.gamePlayersReplaced({ gameId, players: next }));
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
      const card = game?.players[playerId]?.zones[zoneName]?.byId[cardId];
      if (!game || !card) {
        return;
      }
      const cardName = card.name;

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
      if (fields) {
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

      // Unattach detected via empty targetZone; explicit sentinels. See .github/instructions/datatrice-game.instructions.md#servatrice-game-event-quirks.
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
      const handZone = player?.zones[Enriched.ZoneName.HAND];
      if (!game || !player || !handZone) {
        return;
      }

      if (player.zones[Enriched.ZoneName.DECK]) {
        api.dispatch(Actions.zoneCardCountAdjusted({
          gameId, playerId, zoneName: Enriched.ZoneName.DECK, delta: -drawCount,
        }));
      }

      for (const card of cards) {
        api.dispatch(Actions.cardInsertedIntoZone({
          gameId, playerId, zoneName: Enriched.ZoneName.HAND, card,
        }));
      }

      // Opponent draws: bump cardCount for hidden slots. See .github/instructions/datatrice-game.instructions.md#servatrice-game-event-quirks.
      if (drawCount > cards.length) {
        api.dispatch(Actions.zoneCardCountAdjusted({
          gameId, playerId, zoneName: Enriched.ZoneName.HAND,
          delta: drawCount - cards.length,
        }));
      }

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
      if (preGame.activePlayerId === activePlayerId) {
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
