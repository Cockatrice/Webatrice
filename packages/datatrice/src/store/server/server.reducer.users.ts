import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { clone, create } from '@bufbuild/protobuf';
import { Enriched } from '../../types';
import {
  Event_NotifyUser,
  Event_UserMessage,
  Event_UserMessageSchema,
  Response_GetGamesOfUser,
  Response_ResponseCode,
  ServerInfo_User,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import { normalizeGameObject, normalizeGametypeMap } from '../../common';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { CommandFailedPayload, PrivateChatNoticeKind, ServerState } from './server.interfaces';

export const MAX_USER_MESSAGES = 1000;
export const MAX_NOTIFICATIONS = 200;
export const MAX_PRIVATE_CHAT_NOTICES = 200;

let nextNoticeId = 0;

const PRIVATE_MESSAGE_FAILURE_NOTICES: Partial<Record<Response_ResponseCode, PrivateChatNoticeKind>> = {
  [Response_ResponseCode.RespInIgnoreList]: 'ignoredByRecipient',
  [Response_ResponseCode.RespNameNotFound]: 'recipientOffline',
  [Response_ResponseCode.RespChatFlood]: 'chatFlood',
};

function hasConversation(state: ServerState, userName: string): boolean {
  return Boolean(state.messages[userName] || state.privateChatNotices[userName]);
}

function appendPrivateChatNotice(
  state: ServerState,
  userName: string,
  kind: PrivateChatNoticeKind,
  failure?: WebsocketTypes.CommandFailure,
): void {
  const notices = state.privateChatNotices[userName] ?? [];
  const position = state.messages[userName]?.length ?? 0;
  const kept = notices.length >= MAX_PRIVATE_CHAT_NOTICES
    ? notices.slice(notices.length - MAX_PRIVATE_CHAT_NOTICES + 1)
    : notices;
  state.privateChatNotices[userName] = [...kept, { id: nextNoticeId++, kind, position, ...(failure ? { failure } : {}) }];
}

export const userReducers = {
  privateChatOpened: ((state, action) => {
    state.messages[action.payload.userName] ??= [];
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  privateChatClosed: ((state, action) => {
    delete state.messages[action.payload.userName];
    delete state.privateChatNotices[action.payload.userName];
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

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
    if (hasConversation(state, user.name)) {
      appendPrivateChatNotice(state, user.name, 'userJoined');
    }
  }) as CaseReducer<ServerState, PayloadAction<{ user: ServerInfo_User }>>,

  userLeft: ((state, action) => {
    const { name } = action.payload;
    delete state.users[name];
    if (hasConversation(state, name)) {
      appendPrivateChatNotice(state, name, 'userLeft');
    }
  }) as CaseReducer<ServerState, PayloadAction<{ name: string }>>,

  getUserInfo: ((state, action) => {
    const { userInfo } = action.payload;
    state.userInfo[userInfo.name] = userInfo;
  }) as CaseReducer<ServerState, PayloadAction<{ userInfo: ServerInfo_User; requestId?: string }>>,

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
      const trimmed = msgs.length - MAX_USER_MESSAGES + 1;
      state.messages[userName] = msgs.slice(trimmed);
      const notices = state.privateChatNotices[userName];
      if (notices) {
        state.privateChatNotices[userName] = notices
          .filter((notice) => notice.position >= trimmed)
          .map((notice) => ({ ...notice, position: notice.position - trimmed }));
      }
    }
    const { messageData, timeReceived } = action.payload;
    state.messages[userName].push(Object.assign(clone(Event_UserMessageSchema, messageData), { timeReceived }));
  }) as CaseReducer<ServerState, PayloadAction<{ messageData: Event_UserMessage; timeReceived: number }>>,

  privateMessageFailed: ((state, action) => {
    const { userName, responseCode, failure } = action.payload;
    if (failure) {
      appendPrivateChatNotice(state, userName, 'notSent', failure);
      return;
    }
    if (responseCode === Response_ResponseCode.RespNameNotFound) {
      delete state.users[userName];
    }
    const kind = PRIVATE_MESSAGE_FAILURE_NOTICES[responseCode as Response_ResponseCode];
    if (kind) {
      appendPrivateChatNotice(state, userName, kind);
    }
  }) as CaseReducer<ServerState, PayloadAction<CommandFailedPayload & { userName: string; message: string }>>,

  notifyUser: ((state, action) => {
    if (state.notifications.length >= MAX_NOTIFICATIONS) {
      state.notifications = state.notifications.slice(
        state.notifications.length - MAX_NOTIFICATIONS + 1
      );
    }
    state.notifications.push(action.payload.notification);
  }) as CaseReducer<ServerState, PayloadAction<{ notification: Event_NotifyUser }>>,

  gamesOfUserRequested: ((state, action) => {
    const { userName } = action.payload;
    delete state.gamesOfUser[userName];
    delete state.gamesOfUserRoomNames[userName];
    state.gamesOfUserStatus[userName] = { state: 'loading' };
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string }>>,

  gamesOfUser: ((state, action) => {
    const { userName, response } = action.payload;
    const gametypeMaps: { [roomId: number]: Enriched.GametypeMap } = {};
    const roomNames: { [roomId: number]: string } = {};
    for (const room of response.roomList ?? []) {
      roomNames[room.roomId] = room.name;
      gametypeMaps[room.roomId] = normalizeGametypeMap(room.gametypeList ?? []);
    }
    const games: { [gameId: number]: Enriched.Game } = {};
    for (const g of response.gameList ?? []) {
      const normalized = normalizeGameObject(g, gametypeMaps[g.roomId] ?? {});
      games[normalized.info.gameId] = normalized;
    }
    state.gamesOfUser[userName] = games;
    state.gamesOfUserRoomNames[userName] = roomNames;
    state.gamesOfUserStatus[userName] = { state: 'loaded' };
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; response: Response_GetGamesOfUser }>>,

  gamesOfUserFailed: ((state, action) => {
    const { userName, responseCode, failure } = action.payload;
    state.gamesOfUserStatus[userName] = { state: 'failed', responseCode, failure };
  }) as CaseReducer<ServerState, PayloadAction<CommandFailedPayload & { userName: string }>>,
};
