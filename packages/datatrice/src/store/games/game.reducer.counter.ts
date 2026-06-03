import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { clone } from '@bufbuild/protobuf';
import { Event_CreateCounter, Event_DelCounter, Event_SetCounter, ServerInfo_CounterSchema } from '@cockatrice/sockatrice/generated';
import { cloneWith } from '../../common';
import { GamesState } from './game.interfaces';

export const counterReducers = {
  counterCreated: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const player = state.games[gameId]?.players[playerId];
    if (player && data.counterInfo) {
      player.counters[data.counterInfo.id] = clone(ServerInfo_CounterSchema, data.counterInfo);
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_CreateCounter }>>,

  counterSet: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const player = state.games[gameId]?.players[playerId];
    const counter = player?.counters[data.counterId];
    if (!player || !counter) {
      return;
    }
    // Reassign a fresh clone; Immer can't draft protobuf-es, so `counter.count = …` in place
    // would go untracked.
    player.counters[data.counterId] = cloneWith(ServerInfo_CounterSchema, counter, { count: data.value });
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_SetCounter }>>,

  counterDeleted: ((state, action) => {
    const { gameId, playerId, data } = action.payload;
    const player = state.games[gameId]?.players[playerId];
    if (player) {
      delete player.counters[data.counterId];
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; playerId: number; data: Event_DelCounter }>>,
};
