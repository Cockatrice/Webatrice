import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import {
  Response_CardArtRuleEntry,
  Response_GetServerStats,
  Response_ReportUserInfo,
  ServerInfo_ModeratorLogin,
  ServerInfo_UserAlt,
  ServerInfo_UserSchema,
  ServerInfo_UserSession,
} from '@cockatrice/sockatrice/generated';
import { cloneWith } from '../../common';
import { ServerState, ServerStateStaff, UserInvestigation } from './server.interfaces';

export const initialStaffState: ServerStateStaff = {
  investigation: null,
  moderatorLastLogins: null,
  cardArtRules: null,
  serverStats: null,
};

function investigation(state: ServerState, userName: string): UserInvestigation | undefined {
  const active = state.staff.investigation;
  return active?.userName === userName ? active.results : undefined;
}

export const staffReducers = {
  userInvestigationStarted: ((state, action) => {
    state.staff.investigation = { userName: action.payload.userName, results: {} };
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  userInfoReport: ((state, action) => {
    const active = investigation(state, action.payload.info.userName);
    if (active) {
      active.info = action.payload.info;
    }
  }) as CaseReducer<ServerState, PayloadAction<{ info: Response_ReportUserInfo; requestId?: string }>>,

  userAlts: ((state, action) => {
    const active = investigation(state, action.payload.userName);
    if (active) {
      active.alts = action.payload.alts;
    }
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; alts: ServerInfo_UserAlt[] }>>,

  userSessions: ((state, action) => {
    const active = investigation(state, action.payload.userName);
    if (active) {
      active.sessions = action.payload.sessions;
    }
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; sessions: ServerInfo_UserSession[] }>>,

  moderatorLastLogins: ((state, action) => {
    state.staff.moderatorLastLogins = action.payload.logins;
  }) as CaseReducer<ServerState, PayloadAction<{ logins: ServerInfo_ModeratorLogin[] }>>,

  userAvatarRemoved: ((state, action) => {
    const { userName } = action.payload;
    const noAvatar = { avatarBmp: new Uint8Array() };
    if (state.users[userName]) {
      state.users[userName] = cloneWith(ServerInfo_UserSchema, state.users[userName], noAvatar);
    }
    if (state.userInfo[userName]) {
      state.userInfo[userName] = cloneWith(ServerInfo_UserSchema, state.userInfo[userName], noAvatar);
    }
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  cardArtRules: ((state, action) => {
    state.staff.cardArtRules = action.payload.entries;
  }) as CaseReducer<ServerState, PayloadAction<{ entries: Response_CardArtRuleEntry[] }>>,

  cardArtRuleAdded: (() => {}) as CaseReducer<
    ServerState, PayloadAction<{ cardName: string; cardProviderId: string; mode: string; reason: string }>
  >,

  cardArtRuleRemoved: (() => {}) as CaseReducer<ServerState, PayloadAction<{ cardName: string; cardProviderId: string }>>,

  serverStats: ((state, action) => {
    state.staff.serverStats = action.payload.stats;
  }) as CaseReducer<ServerState, PayloadAction<{ stats: Response_GetServerStats }>>,
};
