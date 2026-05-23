import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { ServerInfo_User } from '@cockatrice/sockatrice/generated';
import { ServerState } from './server.interfaces';

export const buddyReducers = {
  updateBuddyList: ((state, action) => {
    const buddyList: { [userName: string]: ServerInfo_User } = {};
    for (const user of action.payload.buddyList) {
      buddyList[user.name] = user;
    }
    state.buddyList = buddyList;
  }) as CaseReducer<ServerState, PayloadAction<{ buddyList: ServerInfo_User[] }>>,

  addToBuddyList: ((state, action) => {
    const { user } = action.payload;
    state.buddyList[user.name] = user;
  }) as CaseReducer<ServerState, PayloadAction<{ user: ServerInfo_User }>>,

  removeFromBuddyList: ((state, action) => {
    delete state.buddyList[action.payload.userName];
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  updateIgnoreList: ((state, action) => {
    const ignoreList: { [userName: string]: ServerInfo_User } = {};
    for (const user of action.payload.ignoreList) {
      ignoreList[user.name] = user;
    }
    state.ignoreList = ignoreList;
  }) as CaseReducer<ServerState, PayloadAction<{ ignoreList: ServerInfo_User[] }>>,

  addToIgnoreList: ((state, action) => {
    const { user } = action.payload;
    state.ignoreList[user.name] = user;
  }) as CaseReducer<ServerState, PayloadAction<{ user: ServerInfo_User }>>,

  removeFromIgnoreList: ((state, action) => {
    delete state.ignoreList[action.payload.userName];
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,
};
