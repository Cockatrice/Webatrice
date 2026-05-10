import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { App, Data } from '@app/types';
import { GamesState } from './game.interfaces';
import { pushEventMessage } from './game.reducer.helpers';

export const primitiveReducers = {
  // Atomic relocation: remove fromCardId from (fromPlayerId, fromZone) and
  // insert `card` into (toPlayerId, toZone) in a single state transition.
  // Source cardCount is decremented unconditionally (clamped at 0) — hidden
  // zones (deck) carry an authoritative cardCount that may exceed
  // order.length, so removals must drop the count whether or not byId
  // contained an entry. Pass fromCardId = -1 when the source slot was an
  // unknown hidden-zone card (rare: server omits cardId, position can't
  // resolve, but newCardId is provided).
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
      const otherTable = otherPlayer?.zones[App.ZoneName.TABLE];
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
          child.attachZone === App.ZoneName.TABLE &&
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
