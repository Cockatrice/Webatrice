import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { ServerInfo_PlayerProperties } from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';

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
    };
    // Track seat/join order; a re-join lands last (filter then push).
    game.seatOrder = game.seatOrder.filter((id) => id !== playerProperties.playerId);
    game.seatOrder.push(playerProperties.playerId);
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerProperties: ServerInfo_PlayerProperties }>>,

  playerLeft: ((state, action) => {
    const { gameId, playerId } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    delete game.players[playerId];
    game.seatOrder = game.seatOrder.filter((id) => id !== playerId);
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; reason: number; timeReceived: number }>>,

  playerPropertiesChanged: (() => {}) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    properties: ServerInfo_PlayerProperties;
  }>>,
};
