import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';

import { ShortcutsState } from './shortcuts.interfaces';

export const recordingReducers = {
  startRecording: ((state, action) => {
    state.recordingActionId = action.payload.actionId;
    state.recordingSequences = [...(state.overrides[action.payload.actionId] ?? [])];
  }) as CaseReducer<ShortcutsState, PayloadAction<{ actionId: string }>>,

  cancelRecording: ((state) => {
    state.recordingActionId = null;
    state.recordingSequences = [];
  }) as CaseReducer<ShortcutsState>,

  // Append a captured sequence to the in-progress recording. De-dupe by string equality —
  // the caller normalizes sequences before appending.
  appendCapturedSequence: ((state, action) => {
    if (!state.recordingActionId) {
      return;
    }
    if (!state.recordingSequences.includes(action.payload.sequence)) {
      state.recordingSequences.push(action.payload.sequence);
    }
  }) as CaseReducer<ShortcutsState, PayloadAction<{ sequence: string }>>,

  removeCapturedSequence: ((state, action) => {
    state.recordingSequences = state.recordingSequences.filter((s) => s !== action.payload.sequence);
  }) as CaseReducer<ShortcutsState, PayloadAction<{ sequence: string }>>,
};
