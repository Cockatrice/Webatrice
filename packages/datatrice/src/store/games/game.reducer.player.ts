import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { ServerInfo_PlayerProperties } from '@cockatrice/sockatrice/generated';
import { GameCommandFailedPayload, GamesState } from './game.interfaces';

export const playerReducers = {
  playerJoined: ((state, action) => {
    const { gameId, playerProperties } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    game.players[playerProperties.playerId] = {
      properties: playerProperties,
      deckList: '',
      zones: {},
      counters: {},
      arrows: {},
      drawSeq: 0,
      lastDrawCount: 0,
    };
    // Track seat/join order; a re-join lands last (filter then push).
    game.seatOrder = game.seatOrder.filter((id) => id !== playerProperties.playerId);
    game.seatOrder.push(playerProperties.playerId);
    state.pings[gameId][playerProperties.playerId] = playerProperties.pingSeconds;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerProperties: ServerInfo_PlayerProperties }>>,

  playerLeft: ((state, action) => {
    const { gameId, playerId } = action.payload;
    const game = state.games[gameId];
    if (!game?.players[playerId]) {
      return;
    }
    delete game.players[playerId];
    game.seatOrder = game.seatOrder.filter((id) => id !== playerId);
    delete state.pings[gameId][playerId];
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; reason: number; timeReceived: number }>>,

  deckSelected: ((state, action) => {
    const { gameId, deckList } = action.payload;
    const game = state.games[gameId];
    const player = game?.players[game.localPlayerId];
    if (!player) {
      return;
    }
    player.deckList = deckList;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; deckList: string; requestId?: string }>>,

  deckSelectFailed: (() => {}) as CaseReducer<GamesState, PayloadAction<GameCommandFailedPayload>>,

  playerPropertiesChanged: (() => {}) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    properties: ServerInfo_PlayerProperties;
    isDeckSelect?: boolean;
  }>>,
};
