import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import {
  Response_WarnList,
  ServerInfo_Ban,
  ServerInfo_ChatMessage,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
  ServerInfo_Warning,
} from '@cockatrice/sockatrice/generated';
import { cloneWith, normalizeLogs } from '../../common';
import { ServerState } from './server.interfaces';

export const moderationReducers = {
  banFromServer: ((state, action) => {
    state.banUser = action.payload.userName;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  banHistory: ((state, action) => {
    state.banHistory[action.payload.userName] = action.payload.banHistory;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; banHistory: ServerInfo_Ban[] }>>,

  warnHistory: ((state, action) => {
    state.warnHistory[action.payload.userName] = action.payload.warnHistory;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; warnHistory: ServerInfo_Warning[] }>>,

  warnListOptions: ((state, action) => {
    state.warnListOptions = action.payload.warnList;
  }) as CaseReducer<ServerState, PayloadAction<{ warnList: Response_WarnList[] }>>,

  warnUser: ((state, action) => {
    state.warnUser = action.payload.userName;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  getAdminNotes: ((state, action) => {
    state.adminNotes[action.payload.userName] = action.payload.notes;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; notes: string }>>,

  updateAdminNotes: ((state, action) => {
    state.adminNotes[action.payload.userName] = action.payload.notes;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; notes: string }>>,

  adjustMod: ((state, action) => {
    const { userName, shouldBeMod, shouldBeJudge } = action.payload;
    const user = state.users[userName];
    if (!user) {
      return;
    }
    let newLevel = user.userLevel;
    newLevel = shouldBeMod
      ? (newLevel | ServerInfo_User_UserLevelFlag.IsModerator)
      : (newLevel & ~ServerInfo_User_UserLevelFlag.IsModerator);
    newLevel = shouldBeJudge
      ? (newLevel | ServerInfo_User_UserLevelFlag.IsJudge)
      : (newLevel & ~ServerInfo_User_UserLevelFlag.IsJudge);
    // Reassign a fresh clone; Immer can't draft protobuf-es, so `user.userLevel = …` in
    // place would go untracked and the moderator badge wouldn't re-render.
    state.users[userName] = cloneWith(ServerInfo_UserSchema, user, { userLevel: newLevel });
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; shouldBeMod: boolean; shouldBeJudge: boolean }>>,

  viewLogs: ((state, action) => {
    state.logs = normalizeLogs(action.payload.logs);
  }) as CaseReducer<ServerState, PayloadAction<{ logs: ServerInfo_ChatMessage[] }>>,

  clearLogs: ((state) => {
    state.logs = { room: [], game: [], chat: [] };
  }) as CaseReducer<ServerState>,
};
