import type { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import type { GamesState } from './game.interfaces';

export interface EventTime { timeReceived: number }

export function withEventTime<P extends EventTime>(reducer: CaseReducer<GamesState, PayloadAction<P>>): {
  reducer: CaseReducer<GamesState, PayloadAction<P>>;
  prepare: (payload: Omit<P, 'timeReceived'> & Partial<EventTime>) => { payload: P };
} {
  return {
    reducer,
    prepare: (payload) => ({ payload: { ...payload, timeReceived: payload.timeReceived ?? Date.now() } as P }),
  };
}
