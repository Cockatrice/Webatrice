import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Event_CreateCounter, Event_DelCounter, Event_SetCounter } from '@cockatrice/sockatrice/generated';
import { GamesState } from './game.interfaces';

export const counterReducers = {
  counterCreated: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const player = state.games[gameId]?.players[playerId];
    if (player && data.counterInfo) {
      player.counters[data.counterInfo.id] = { ...data.counterInfo };
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_CreateCounter }>>,

  counterSet: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const game = state.games[gameId];
    const counter = game?.players[playerId]?.counters[data.counterId];
    if (!game || !counter) {
      return;
    }
    counter.count = data.value;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_SetCounter }>>,

  counterDeleted: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const player = state.games[gameId]?.players[playerId];
    if (player) {
      delete player.counters[data.counterId];
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_DelCounter }>>,
};
