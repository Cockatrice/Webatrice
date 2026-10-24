import { App, Enriched } from '../../types';
import {
  Event_NotifyUser,
  Event_ServerShutdown,
  Event_UserMessage,
  Response_CardArtRuleEntry,
  Response_DeckList,
  Response_GetServerStats,
  Response_ReportStats,
  Response_ReportUserInfo,
  Response_WarnList,
  ServerInfo_Ban,
  ServerInfo_ChatMessage,
  ServerInfo_DeckShareSummary,
  ServerInfo_ModeratorLogin,
  ServerInfo_ReplayMatch,
  ServerInfo_Report,
  ServerInfo_User,
  ServerInfo_UserAlt,
  ServerInfo_UserSession,
  ServerInfo_Warning,
} from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

export type TestConnectionStatus = 'testing' | 'success' | 'failed' | null;

export type PrivateMessage = Event_UserMessage & { timeReceived: number };

export interface ServerState {
  initialized: boolean;
  sessionEpoch: number;
  testConnectionStatus: TestConnectionStatus;
  buddyList: { [userName: string]: ServerInfo_User };
  ignoreList: { [userName: string]: ServerInfo_User };
  info: ServerStateInfo;
  status: ServerStateStatus;
  connectionHealth: ServerConnectionHealth;
  latency: ServerLatency;
  connectUnreachable: boolean;
  loginFailureCode?: number | null;
  logs: ServerStateLogs;
  user: ServerInfo_User | null;
  users: { [userName: string]: ServerInfo_User };
  sortUsersBy: ServerStateSortUsersBy;
  locale: string | undefined;
  messages: {
    [userName: string]: PrivateMessage[];
  };
  privateChatNotices: {
    [userName: string]: PrivateChatNotice[];
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
  deckSharesMine: ServerInfo_DeckShareSummary[] | null;
  publicDecks: { [userName: string]: Response_DeckList };
  downloadedReplay: { replayId: number; replayData: Uint8Array } | null;
  gamesOfUser: { [userName: string]: { [gameId: number]: Enriched.Game } };
  gamesOfUserRoomNames: { [userName: string]: { [roomId: number]: string } };
  gamesOfUserStatus: { [userName: string]: GamesOfUserStatus };
  registrationError: string | null;
  staff: ServerStateStaff;
  reports: ServerStateReports;
}

export interface CommandFailedPayload {
  requestId?: string;
  responseCode: number;
  failure?: WebsocketTypes.CommandFailure;
}

export interface SessionCommandFailedPayload extends CommandFailedPayload {
  command: WebsocketTypes.SessionCommandName;
  target: string;
}

export type GamesOfUserStatus =
  | { state: 'loading' }
  | { state: 'loaded' }
  | ({ state: 'failed' } & CommandFailedPayload);

export type PrivateChatNoticeKind =
  | 'ignoredByRecipient'
  | 'recipientOffline'
  | 'chatFlood'
  | 'notSent'
  | 'userLeft'
  | 'userJoined';

export interface PrivateChatNotice {
  id: number;
  kind: PrivateChatNoticeKind;
  position: number;
  failure?: WebsocketTypes.CommandFailure;
}

export type PrivateConversationEntry =
  | { type: 'message'; message: PrivateMessage }
  | { type: 'notice'; notice: PrivateChatNotice };

export interface ServerStateStatus {
  connectionAttemptMade: boolean;
  description: string | null;
  state: WebsocketTypes.StatusEnum;
}

export interface ServerConnectionHealth {
  missedPongs: number;
  silentForMs: number;
}

export interface ServerLatency {
  stats: WebsocketTypes.LatencyStats;
  samplesMs: number[];
}

export interface ServerStateInfo {
  message: string | null;
  name: string | null;
  version: string | null;
  supportsPasswordHash?: boolean;
}

export interface ServerStateLogs {
  room: ServerInfo_ChatMessage[];
  game: ServerInfo_ChatMessage[];
  chat: ServerInfo_ChatMessage[];
}

export interface ServerStateStaff {
  investigation: { userName: string; results: UserInvestigation } | null;
  moderatorLastLogins: ServerInfo_ModeratorLogin[] | null;
  cardArtRules: Response_CardArtRuleEntry[] | null;
  serverStats: Response_GetServerStats | null;
}

export interface UserInvestigation {
  info?: Response_ReportUserInfo;
  alts?: ServerInfo_UserAlt[];
  sessions?: ServerInfo_UserSession[];
}

export interface ServerStateSortUsersBy extends App.SortBy {
  field: App.UserSortField;
}

export interface ServerStateReports {
  mine: number[] | null;
  queue: number[] | null;
  queueTotalCount: number;
  byId: { [reportId: number]: ServerInfo_Report };
  details: { [reportId: number]: ServerInfo_Report };
  stats: Response_ReportStats | null;
  replay: { gameId: number; replayId: number; replayData: Uint8Array } | null;
  lastNotice: { notification: Event_NotifyUser } | null;
}
