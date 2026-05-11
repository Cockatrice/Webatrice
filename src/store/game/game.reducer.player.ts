import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Data } from '@app/types';
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
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerProperties: Data.ServerInfo_PlayerProperties }>>,

  playerLeft: ((state, action) => {
    const { gameId, playerId } = action.payload;
    const game = state.games[gameId];
    if (!game) {
      return;
    }
    delete game.players[playerId];
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; reason: number; timeReceived: number }>>,

  playerPropertiesChanged: (() => {}) as CaseReducer<GamesState, PayloadAction<{
    gameId: number;
    playerId: number;
    properties: Data.ServerInfo_PlayerProperties;
  }>>,
};
