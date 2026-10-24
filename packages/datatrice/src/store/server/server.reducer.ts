import { createSlice } from '@reduxjs/toolkit';

import { accountReducers } from './server.reducer.account';
import { buddyReducers } from './server.reducer.buddies';
import { connectionReducers, initialState } from './server.reducer.connection';
import { deckReducers } from './server.reducer.decks';
import { moderationReducers } from './server.reducer.moderation';
import { replayReducers } from './server.reducer.replays';
import { staffReducers } from './server.reducer.staff';
import { reportReducers } from './server.reducer.reports';
import { userReducers } from './server.reducer.users';

export { MAX_USER_MESSAGES, MAX_NOTIFICATIONS } from './server.reducer.users';

export const serverSlice = createSlice({
  name: 'server',
  initialState,
  reducers: {
    ...connectionReducers,
    ...buddyReducers,
    ...userReducers,
    ...moderationReducers,
    ...replayReducers,
    ...deckReducers,
    ...accountReducers,
    ...staffReducers,
    ...reportReducers,
  },
});

export const serverReducer = serverSlice.reducer;
