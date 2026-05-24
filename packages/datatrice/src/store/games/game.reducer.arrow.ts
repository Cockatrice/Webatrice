import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Event_CreateArrow, Event_DeleteArrow } from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';

export const arrowReducers = {
  arrowCreated: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const game = state.games[gameId];
    const player = game?.players[playerId];
    if (!game || !player || !data.arrowInfo) {
      return;
    }
    player.arrows[data.arrowInfo.id] = { ...data.arrowInfo };
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_CreateArrow }>>,

  arrowDeleted: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const player = state.games[gameId]?.players[playerId];
    if (player) {
      delete player.arrows[data.arrowId];
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_DeleteArrow }>>,
};
