import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Data, Enriched } from '../../types';
import { mergeSetFields } from '../../common';
import { GamesState } from './game.interfaces';
import { pushEventMessage } from './game.reducer.helpers';

export const primitiveReducers = {
  gamePlayersReplaced: ((state, action) => {
    const { gameId, players } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    game.players = players;
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    players: { [playerId: number]: Enriched.PlayerEntry };
  }>>,

  gameInfoUpdated: ((state, action) => {
    const { gameId, gameStarted, activePlayerId, activePhase, secondsElapsed } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    if (gameStarted !== undefined) {
      game.started = gameStarted;
    }
    if (activePlayerId !== undefined) {
      game.activePlayerId = activePlayerId;
    }
    if (activePhase !== undefined) {
      game.activePhase = activePhase;
    }
    if (secondsElapsed !== undefined) {
      game.secondsElapsed = secondsElapsed;
    }
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    gameStarted?: boolean;
    activePlayerId?: number;
    activePhase?: number;
    secondsElapsed?: number;
  }>>,

  cardMovedBetweenZones: ((state, action) => {
    const {
      gameId, fromPlayerId, fromZone, fromCardId,
      toPlayerId, toZone, card,
    } = action.payload;
    const game = state.games[gameId];
    const sourceZone = game?.players[fromPlayerId]?.zones[fromZone];
    const targetZone = game?.players[toPlayerId]?.zones[toZone];
    if (!game || !sourceZone || !targetZone) {
      return;
    }

    if (fromCardId >= 0) {
      const idx = sourceZone.order.indexOf(fromCardId);
      if (idx >= 0) {
        sourceZone.order.splice(idx, 1);
      }
      delete sourceZone.byId[fromCardId];
    }
    sourceZone.cardCount = Math.max(0, sourceZone.cardCount - 1);

    targetZone.order.push(card.id);
    targetZone.byId[card.id] = card;
    targetZone.cardCount++;
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    fromPlayerId: number;
    fromZone: string;
    fromCardId: number;
    toPlayerId: number;
    toZone: string;
    card: Data.ServerInfo_Card;
  }>>,

  // Cross-player TABLE→TABLE gap-fill. Servatrice does NOT emit unattach
  // events when zone names match (server_abstract_player.cpp:376), and
  // reassigns the parent's id on cross-player move (line 449). Cockatrice
  // desktop survives via Qt pointer-linkage (card_zone.cpp:19); our
  // wire-data-driven model has no such linkage, so we walk every player's
  // table and rewrite each attached child's parent pointer to (toPlayerId,
  // toCardId). Same-player intra-table moves still pass through but produce
  // a no-op rewrite.
  cardAttachmentReparented: ((state, action) => {
    const { gameId, fromPlayerId, fromCardId, toPlayerId, toCardId } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    for (const otherPlayer of Object.values(game.players)) {
      const otherTable = otherPlayer?.zones[Enriched.ZoneName.TABLE];
      if (!otherTable) {
        continue;
      }
      for (const childId of otherTable.order) {
        const child = otherTable.byId[childId];
        if (!child) {
          continue;
        }
        if (
          child.attachPlayerId === fromPlayerId &&
          child.attachZone === Enriched.ZoneName.TABLE &&
          child.attachCardId === fromCardId
        ) {
          otherTable.byId[childId] = {
            ...child,
            attachPlayerId: toPlayerId,
            attachCardId: toCardId,
          };
        }
      }
    }
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    fromPlayerId: number;
    fromCardId: number;
    toPlayerId: number;
    toCardId: number;
  }>>,

  // Partial-field card update with a fresh byId[cardId] object. Cards are
  // protobuf-es messages, which Immer does not recognise as draftable —
  // mutating `card.attachCardId` (or any other proto field) in place leaves
  // the surrounding zone / byId references unchanged, so the WeakMap-keyed
  // selectors in game.selectors.ts return stale arrays and the UI doesn't
  // re-render until something else dirties the zone. Assigning a fresh
  // object to `zone.byId[cardId]` triggers Immer's normal structural-sharing
  // path. Caller assembles the partial; the primitive does the reassign.
  // Used by cardAttrChanged / cardCounterChanged / cardAttached listeners
  // (each owns its own interpretation of the wire payload above).
  cardFieldsUpdated: ((state, action) => {
    const { gameId, playerId, zoneName, cardId, fields } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    const card = zone?.byId[cardId];
    if (!zone || !card) {
      return;
    }
    zone.byId[cardId] = { ...card, ...fields };
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    zoneName: string;
    cardId: number;
    fields: Partial<Data.ServerInfo_Card>;
  }>>,

  cardInsertedIntoZone: ((state, action) => {
    const { gameId, playerId, zoneName, card } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }
    zone.order.push(card.id);
    zone.byId[card.id] = card;
    zone.cardCount++;
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    zoneName: string;
    card: Data.ServerInfo_Card;
  }>>,

  cardRemovedFromZone: ((state, action) => {
    const { gameId, playerId, zoneName, cardId } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }
    const idx = zone.order.indexOf(cardId);
    if (idx >= 0) {
      zone.order.splice(idx, 1);
    }
    delete zone.byId[cardId];
    zone.cardCount = Math.max(0, zone.cardCount - 1);
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    zoneName: string;
    cardId: number;
  }>>,

  zoneCardCountAdjusted: ((state, action) => {
    const { gameId, playerId, zoneName, delta } = action.payload;
    const zone = state.games[gameId]?.players[playerId]?.zones[zoneName];
    if (!zone) {
      return;
    }
    zone.cardCount = Math.max(0, zone.cardCount + delta);
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    zoneName: string;
    delta: number;
  }>>,

  playerPropertiesUpdated: ((state, action) => {
    const { gameId, playerId, properties } = action.payload;
    const player = state.games[gameId]?.players[playerId];
    if (!player) {
      return;
    }
    mergeSetFields(Data.ServerInfo_PlayerPropertiesSchema, player.properties, properties);
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    properties: Data.ServerInfo_PlayerProperties;
  }>>,

  gameMessageAppended: ((state, action) => {
    const { gameId, playerId, message } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    pushEventMessage(game, playerId, message);
  }) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    message: string;
  }>>,
};
