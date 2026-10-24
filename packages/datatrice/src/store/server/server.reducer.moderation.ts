import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import {
  Response_WarnList,
  ServerInfo_Ban,
  ServerInfo_ChatMessage,
  ServerInfo_User,
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
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; banHistory: ServerInfo_Ban[]; requestId?: string }>>,

  warnHistory: ((state, action) => {
    state.warnHistory[action.payload.userName] = action.payload.warnHistory;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; warnHistory: ServerInfo_Warning[]; requestId?: string }>>,

  warnListOptions: ((state, action) => {
    state.warnListOptions = action.payload.warnList;
  }) as CaseReducer<ServerState, PayloadAction<{ warnList: Response_WarnList[]; requestId?: string }>>,

  warnUser: ((state, action) => {
    state.warnUser = action.payload.userName;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  getAdminNotes: ((state, action) => {
    state.adminNotes[action.payload.userName] = action.payload.notes;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; notes: string; requestId?: string }>>,

  updateAdminNotes: ((state, action) => {
    state.adminNotes[action.payload.userName] = action.payload.notes;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; notes: string }>>,

  adjustMod: ((state, action) => {
    const { userName, shouldBeMod, shouldBeJudge, shouldBeDeveloper } = action.payload;
    const applyFlag = (level: number, flag: ServerInfo_User_UserLevelFlag, on: boolean | undefined): number => {
      if (on === undefined) {
        return level;
      }
      return on ? (level | flag) : (level & ~flag);
    };
    const apply = (user: ServerInfo_User): ServerInfo_User => {
      let newLevel = applyFlag(user.userLevel, ServerInfo_User_UserLevelFlag.IsModerator, shouldBeMod);
      newLevel = applyFlag(newLevel, ServerInfo_User_UserLevelFlag.IsJudge, shouldBeJudge);
      newLevel = applyFlag(newLevel, ServerInfo_User_UserLevelFlag.IsDeveloper, shouldBeDeveloper);
      // Reassign a fresh clone; Immer can't draft protobuf-es, so `user.userLevel = …` in
      // place would go untracked and the moderator badge wouldn't re-render.
      return cloneWith(ServerInfo_UserSchema, user, { userLevel: newLevel });
    };
    if (state.users[userName]) {
      state.users[userName] = apply(state.users[userName]);
    }
    if (state.userInfo[userName]) {
      state.userInfo[userName] = apply(state.userInfo[userName]);
    }
  }) as CaseReducer<ServerState, PayloadAction<{
    userName: string;
    shouldBeMod?: boolean;
    shouldBeJudge?: boolean;
    shouldBeDeveloper?: boolean;
    requestId?: string;
  }>>,

  viewLogs: ((state, action) => {
    state.logs = normalizeLogs(action.payload.logs);
  }) as CaseReducer<ServerState, PayloadAction<{ logs: ServerInfo_ChatMessage[]; requestId?: string }>>,

  clearLogs: ((state) => {
    state.logs = { room: [], game: [], chat: [] };
  }) as CaseReducer<ServerState>,
};
