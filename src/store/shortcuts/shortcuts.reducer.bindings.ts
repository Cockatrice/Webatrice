import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';

import { ShortcutsState } from './shortcuts.interfaces';

export const initialState: ShortcutsState = {
  overrides: {},
  hydrated: false,
  recordingActionId: null,
  recordingSequences: [],
};

export const bindingsReducers = {
  hydrate: ((state, action) => {
    if (state.hydrated) {
      return;
    }
    state.overrides = action.payload.overrides;
    state.hydrated = true;
  }) as CaseReducer<ShortcutsState, PayloadAction<{ overrides: Record<string, string[]> }>>,

  setOverride: ((state, action) => {
    state.overrides[action.payload.actionId] = action.payload.sequences;
  }) as CaseReducer<ShortcutsState, PayloadAction<{ actionId: string; sequences: string[] }>>,

  resetAction: ((state, action) => {
    delete state.overrides[action.payload.actionId];
  }) as CaseReducer<ShortcutsState, PayloadAction<{ actionId: string }>>,

  resetAll: ((state) => {
    state.overrides = {};
  }) as CaseReducer<ShortcutsState>,
};
