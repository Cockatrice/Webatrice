import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { create } from '@bufbuild/protobuf';
import { Enriched } from '../../types';
import {
  Event_NotifyUser,
  Event_UserMessage,
  Response_GetGamesOfUser,
  ServerInfo_User,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import { normalizeGameObject, normalizeGametypeMap } from '../../common';
import { ServerState } from './server.interfaces';

export const MAX_USER_MESSAGES = 1000;

export const userReducers = {
  updateUser: ((state, action) => {
    if (state.user) {
      state.user = create(ServerInfo_UserSchema, { ...state.user, ...action.payload.user });
    } else {
      state.user = action.payload.user as ServerInfo_User;
    }
  }) as CaseReducer<ServerState, PayloadAction<{ user: Partial<ServerInfo_User> }>>,

  updateUsers: ((state, action) => {
    const users: { [userName: string]: ServerInfo_User } = {};
    for (const user of action.payload.users) {
      users[user.name] = user;
    }
    state.users = users;
  }) as CaseReducer<ServerState, PayloadAction<{ users: ServerInfo_User[] }>>,

  userJoined: ((state, action) => {
    const { user } = action.payload;
    state.users[user.name] = user;
  }) as CaseReducer<ServerState, PayloadAction<{ user: ServerInfo_User }>>,

  userLeft: ((state, action) => {
    delete state.users[action.payload.name];
  }) as CaseReducer<ServerState, PayloadAction<{ name: string }>>,

  getUserInfo: ((state, action) => {
    const { userInfo } = action.payload;
    state.userInfo[userInfo.name] = userInfo;
  }) as CaseReducer<ServerState, PayloadAction<{ userInfo: ServerInfo_User }>>,

  userMessage: ((state, action) => {
    if (!state.user) {
      return;
    }
    const { senderName, receiverName } = action.payload.messageData;
    const userName = state.user.name === senderName ? receiverName : senderName;
    if (!state.messages[userName]) {
      state.messages[userName] = [];
    }
    const msgs = state.messages[userName];
    if (msgs.length >= MAX_USER_MESSAGES) {
      state.messages[userName] = msgs.slice(msgs.length - MAX_USER_MESSAGES + 1);
    }
    state.messages[userName].push(action.payload.messageData);
  }) as CaseReducer<ServerState, PayloadAction<{ messageData: Event_UserMessage }>>,

  notifyUser: ((state, action) => {
    state.notifications.push(action.payload.notification);
  }) as CaseReducer<ServerState, PayloadAction<{ notification: Event_NotifyUser }>>,

  gamesOfUser: ((state, action) => {
    const { userName, response } = action.payload;
    const gametypeMap = normalizeGametypeMap(
      (response.roomList ?? []).flatMap(room => room.gametypeList ?? [])
    );
    const games: { [gameId: number]: Enriched.Game } = {};
    for (const g of response.gameList ?? []) {
      const normalized = normalizeGameObject(g, gametypeMap);
      games[normalized.info.gameId] = normalized;
    }
    state.gamesOfUser[userName] = games;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; response: Response_GetGamesOfUser }>>,
};
