import { createSelector } from '@reduxjs/toolkit';
import {
  Response_DeckList,
  Response_WarnList,
  ServerInfo_ReplayMatch,
  ServerInfo_User,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { SortUtil } from '../../common';
import { Enriched } from '../../types';
import { ServerCapability, serverSupports } from './server.capabilities';
import {
  GamesOfUserStatus, PrivateChatNotice, PrivateConversationEntry, PrivateMessage, ServerState, UserInvestigation,
} from './server.interfaces';
import { EMPTY_LATENCY, HEALTHY_CONNECTION_HEALTH } from './server.reducer.connection';
import { reportSelectors } from './server.selectors.reports';

type State = { server: ServerState };

const EMPTY_USERS: ServerInfo_User[] = [];
const EMPTY_REPLAYS: ServerInfo_ReplayMatch[] = [];
const EMPTY_MESSAGES: PrivateMessage[] = [];
const EMPTY_NOTICES: PrivateChatNotice[] = [];
const EMPTY_GAMES: { [gameId: number]: Enriched.Game } = {};
const EMPTY_ROOM_NAMES: { [roomId: number]: string } = {};

const getPrivateChatNotices = ({ server }: State, userName: string): PrivateChatNotice[] =>
  server.privateChatNotices[userName] ?? EMPTY_NOTICES;

export const selectSessionEpoch = ({ server }: State): number => server.sessionEpoch ?? 0;

export const Selectors = {
  selectSessionEpoch,
  getInitialized: ({ server }: State) => server.initialized,
  getMessage: ({ server }: State) => server.info.message,
  getName: ({ server }: State) => server.info.name,
  getVersion: ({ server }: State) => server.info.version,
  getSupportsPasswordHash: ({ server }: State) => server.info.supportsPasswordHash,
  getDescription: ({ server }: State) => server.status.description,
  getState: ({ server }: State) => server.status.state,
  getConnectionAttemptMade: ({ server }: State) => server.status.connectionAttemptMade,
  getTestConnectionStatus: ({ server }: State) => server.testConnectionStatus,
  getConnectionHealth: ({ server }: State) => server.connectionHealth ?? HEALTHY_CONNECTION_HEALTH,
  getIsServerUnresponsive: ({ server }: State) => (server.connectionHealth?.missedPongs ?? 0) > 0,
  getLatency: ({ server }: State) => server.latency ?? EMPTY_LATENCY,
  getConnectUnreachable: ({ server }: State) => server.connectUnreachable ?? false,
  getLoginFailureCode: ({ server }: State) => server.loginFailureCode ?? null,
  supports: ({ server }: State, capability: ServerCapability): boolean =>
    serverSupports(server.info.version, capability),
  getUser: ({ server }: State) => server.user,

  getIsConnected: createSelector(
    [({ server }: State) => server.status.state],
    (state): boolean => state === WebsocketTypes.StatusEnum.LOGGED_IN
  ),

  getIsUserModerator: createSelector(
    [({ server }: State) => server.user],
    (user): boolean => {
      if (!user) {
        return false;
      }
      const mask = ServerInfo_User_UserLevelFlag.IsModerator;
      return (user.userLevel & mask) === mask;
    }
  ),

  getIsUserJudge: createSelector(
    [({ server }: State) => server.user],
    (user): boolean => {
      if (!user) {
        return false;
      }
      const mask = ServerInfo_User_UserLevelFlag.IsJudge;
      return (user.userLevel & mask) === mask;
    }
  ),

  getIsUserDeveloper: createSelector(
    [({ server }: State) => server.user],
    (user): boolean => {
      if (!user) {
        return false;
      }
      const mask = ServerInfo_User_UserLevelFlag.IsDeveloper;
      return (user.userLevel & mask) === mask;
    }
  ),

  getIsUserRegistered: createSelector(
    [({ server }: State) => server.user],
    (user): boolean => {
      if (!user) {
        return false;
      }
      const mask = ServerInfo_User_UserLevelFlag.IsRegistered;
      return (user.userLevel & mask) === mask;
    }
  ),

  // Admin flag on the local user. Mirrors getIsUserModerator; used by
  // the player-list context menu to gate the Promote/Demote items
  // (Cockatrice's user_context_menu.cpp:401-402, 410-411 — those
  // entries are only added when the local user has UserLevelFlag.IsAdmin).
  getIsUserAdmin: createSelector(
    [({ server }: State) => server.user],
    (user): boolean => {
      if (!user) {
        return false;
      }
      const mask = ServerInfo_User_UserLevelFlag.IsAdmin;
      return (user.userLevel & mask) === mask;
    }
  ),
  getUserInfoByName: ({ server }: State, userName: string): ServerInfo_User | undefined =>
    server.userInfo[userName],

  // History / notes lookups keyed by target user name. The state slots
  // are hydrated by the moderator response handlers (see
  // ModeratorResponseImpl.banHistory / warnHistory / getAdminNotes).
  // Callers dispatch the corresponding sockatrice command
  // (getBanHistory / getWarnHistory / getAdminNotes) and read here
  // once the response lands.
  getBanHistoryByUser: ({ server }: State, userName: string) =>
    server.banHistory[userName],
  getWarnHistoryByUser: ({ server }: State, userName: string) =>
    server.warnHistory[userName],
  getAdminNotesByUser: ({ server }: State, userName: string) =>
    server.adminNotes[userName],
  getWarnListForUser: ({ server }: State, userName: string): Response_WarnList | undefined =>
    server.warnListOptions.find((list) => list.userName === userName),
  getLogs: ({ server }: State) => server.logs,
  getUserInvestigation: ({ server }: State, userName: string): UserInvestigation | undefined => {
    const active = server.staff.investigation;
    return active?.userName === userName ? active.results : undefined;
  },
  getModeratorLastLogins: ({ server }: State) => server.staff.moderatorLastLogins,
  getCardArtRules: ({ server }: State) => server.staff.cardArtRules,
  getServerStats: ({ server }: State) => server.staff.serverStats,
  getBackendDecks: ({ server }: State) => server.backendDecks,
  getDownloadedDeck: ({ server }: State) => server.downloadedDeck,
  getDeckSharesMine: ({ server }: State) => server.deckSharesMine,
  getPublicDecks: ({ server }: State, userName: string): Response_DeckList | undefined => server.publicDecks[userName],
  getDownloadedReplay: ({ server }: State) => server.downloadedReplay,
  getRegistrationError: ({ server }: State) => server.registrationError,
  getNotifications: ({ server }: State) => server.notifications,
  getServerShutdown: ({ server }: State) => server.serverShutdown,
  getSortUsersBy: ({ server }: State) => server.sortUsersBy,

  // Private-message history with a specific user. Both directions
  // (sent + received) are stored under the OTHER user's name — the
  // reducer keys on `sender === self ? receiver : sender` — so a
  // single lookup returns the full conversation. Returns a stable
  // empty array when there's no history yet so callers can rely on
  // referential equality in memoized selectors.
  getPrivateMessagesForUser: ({ server }: State, userName: string): PrivateMessage[] =>
    server.messages[userName] ?? EMPTY_MESSAGES,

  getPrivateConversation: createSelector(
    [
      ({ server }: State, userName: string) => server.messages[userName] ?? EMPTY_MESSAGES,
      getPrivateChatNotices,
    ],
    (messages, notices): PrivateConversationEntry[] => {
      const entries: PrivateConversationEntry[] = [];
      let next = 0;
      messages.forEach((message, index) => {
        while (next < notices.length && notices[next].position <= index) {
          entries.push({ type: 'notice', notice: notices[next++] });
        }
        entries.push({ type: 'message', message });
      });
      while (next < notices.length) {
        entries.push({ type: 'notice', notice: notices[next++] });
      }
      return entries;
    },
  ),

  getIsUserOnline: ({ server }: State, userName: string): boolean => Boolean(server.users[userName]),

  getGamesOfUser: createSelector(
    [({ server }: State, userName: string) => server.gamesOfUser[userName] ?? EMPTY_GAMES],
    (games): Enriched.Game[] => Object.values(games),
  ),
  getGamesOfUserStatus: ({ server }: State, userName: string): GamesOfUserStatus | undefined =>
    server.gamesOfUserStatus[userName],
  getGamesOfUserRoomNames: ({ server }: State, userName: string): { [roomId: number]: string } =>
    server.gamesOfUserRoomNames[userName] ?? EMPTY_ROOM_NAMES,

  getUsers: ({ server }: State) => server.users,
  getBuddyList: ({ server }: State) => server.buddyList,
  getIgnoreList: ({ server }: State) => server.ignoreList,
  getReplays: ({ server }: State) => server.replays,

  getSortedUsers: createSelector(
    [
      (state: State) => state.server.users,
      (state: State) => state.server.sortUsersBy,
      (state: State) => state.server.locale,
    ],
    (users, sortBy, locale): ServerInfo_User[] => {
      if (!users || Object.keys(users).length === 0) {
        return EMPTY_USERS;
      }
      return SortUtil.sortedUsersByField(Object.values(users), sortBy, locale);
    }
  ),

  getSortedBuddyList: createSelector(
    [
      (state: State) => state.server.buddyList,
      (state: State) => state.server.sortUsersBy,
      (state: State) => state.server.locale,
    ],
    (buddyList, sortBy, locale): ServerInfo_User[] => {
      if (!buddyList || Object.keys(buddyList).length === 0) {
        return EMPTY_USERS;
      }
      return SortUtil.sortedUsersByField(Object.values(buddyList), sortBy, locale);
    }
  ),

  getSortedIgnoreList: createSelector(
    [
      (state: State) => state.server.ignoreList,
      (state: State) => state.server.sortUsersBy,
      (state: State) => state.server.locale,
    ],
    (ignoreList, sortBy, locale): ServerInfo_User[] => {
      if (!ignoreList || Object.keys(ignoreList).length === 0) {
        return EMPTY_USERS;
      }
      return SortUtil.sortedUsersByField(Object.values(ignoreList), sortBy, locale);
    }
  ),

  getReplaysList: createSelector(
    [(state: State) => state.server.replays],
    (replays): ServerInfo_ReplayMatch[] => {
      if (!replays || Object.keys(replays).length === 0) {
        return EMPTY_REPLAYS;
      }
      return Object.values(replays).sort((a, b) => a.gameId - b.gameId);
    }
  ),

  ...reportSelectors,
}
