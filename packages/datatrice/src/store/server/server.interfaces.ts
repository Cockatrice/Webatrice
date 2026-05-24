import { App, Enriched } from '../../types';
import {
  Event_NotifyUser,
  Event_ServerShutdown,
  Event_UserMessage,
  Response_DeckList,
  Response_WarnList,
  ServerInfo_Ban,
  ServerInfo_ChatMessage,
  ServerInfo_ReplayMatch,
  ServerInfo_User,
  ServerInfo_Warning,
} from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

export type TestConnectionStatus = 'testing' | 'success' | 'failed' | null;

export interface ServerState {
  initialized: boolean;
  testConnectionStatus: TestConnectionStatus;
  buddyList: { [userName: string]: ServerInfo_User };
  ignoreList: { [userName: string]: ServerInfo_User };
  info: ServerStateInfo;
  status: ServerStateStatus;
  logs: ServerStateLogs;
  user: ServerInfo_User | null;
  users: { [userName: string]: ServerInfo_User };
  sortUsersBy: ServerStateSortUsersBy;
  messages: {
    [userName: string]: Event_UserMessage[];
  };
  userInfo: {
    [userName: string]: ServerInfo_User;
  };
  notifications: Event_NotifyUser[];
  serverShutdown: Event_ServerShutdown | null;
  banUser: string;
  banHistory: {
    [userName: string]: ServerInfo_Ban[];
  };
  warnHistory: {
    [userName: string]: ServerInfo_Warning[];
  };
  warnListOptions: Response_WarnList[];
  warnUser: string;
  adminNotes: { [userName: string]: string };
  replays: { [gameId: number]: ServerInfo_ReplayMatch };
  backendDecks: Response_DeckList | null;
  downloadedDeck: { deckId: number; deck: string } | null;
  downloadedReplay: { replayId: number; replayData: Uint8Array } | null;
  gamesOfUser: { [userName: string]: { [gameId: number]: Enriched.Game } };
  registrationError: string | null;
}

export interface ServerStateStatus {
  connectionAttemptMade: boolean;
  description: string | null;
  state: WebsocketTypes.StatusEnum;
}

export interface ServerStateInfo {
  message: string | null;
  name: string | null;
  version: string | null;
}

export interface ServerStateLogs {
  room: ServerInfo_ChatMessage[];
  game: ServerInfo_ChatMessage[];
  chat: ServerInfo_ChatMessage[];
}

export interface ServerStateSortUsersBy extends App.SortBy {
  field: App.UserSortField;
}
