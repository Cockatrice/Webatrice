import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { Data } from '../../types';
import { GamesState } from './game.interfaces';

export const turnReducers = {
  gameHostChanged: ((state, action) => {
    const { gameId, hostId } = action.payload;
    const game = state.games[gameId];
    if (game) {
      game.hostId = hostId;
    }
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; hostId: number }>>,

  gameStateChanged: (() => {}) as CaseReducer<GamesState, PayloadAction<{ gameId: number; data: Data.Event_GameStateChanged }>>,

  activePlayerSet: ((state, action) => {
    const game = state.games[action.payload.gameId];
    if (!game) {
      return;
    }
    game.activePlayerId = action.payload.activePlayerId;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; activePlayerId: number }>>,

  activePhaseSet: ((state, action) => {
    const game = state.games[action.payload.gameId];
    if (!game) {
      return;
    }
    game.activePhase = action.payload.phase;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; phase: number }>>,

  turnReversed: ((state, action) => {
    const game = state.games[action.payload.gameId];
    if (!game) {
      return;
    }
    game.reversed = action.payload.reversed;
  }) as CaseReducer<GamesState, PayloadAction<{ gameId: number; reversed: boolean }>>,
};
