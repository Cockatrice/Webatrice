import { createSlice } from '@reduxjs/toolkit';

import { bindingsReducers, initialState } from './shortcuts.reducer.bindings';
import { recordingReducers } from './shortcuts.reducer.recording';

export const shortcutsSlice = createSlice({
  name: 'shortcuts',
  initialState,
  reducers: {
    ...bindingsReducers,
    ...recordingReducers,
  },
});

export const shortcutsReducer = shortcutsSlice.reducer;
