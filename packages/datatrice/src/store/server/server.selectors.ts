import { createSelector } from '@reduxjs/toolkit';
import {
  Event_UserMessage,
  ServerInfo_ReplayMatch,
  ServerInfo_User,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { SortUtil } from '../../common';
import { ServerState } from './server.interfaces';
import { HEALTHY_CONNECTION_HEALTH } from './server.reducer.connection';

type State = { server: ServerState };

const EMPTY_USERS: ServerInfo_User[] = [];
const EMPTY_REPLAYS: ServerInfo_ReplayMatch[] = [];
const EMPTY_MESSAGES: Event_UserMessage[] = [];

export const Selectors = {
  getInitialized: ({ server }: State) => server.initialized,
  getMessage: ({ server }: State) => server.info.message,
  getName: ({ server }: State) => server.info.name,
  getVersion: ({ server }: State) => server.info.version,
  getDescription: ({ server }: State) => server.status.description,
  getState: ({ server }: State) => server.status.state,
  getConnectionAttemptMade: ({ server }: State) => server.status.connectionAttemptMade,
  getTestConnectionStatus: ({ server }: State) => server.testConnectionStatus,
  // Stable fallback: preloaded/partial states (host-supplied or test
  // fixtures) may predate the connectionHealth field.
  getConnectionHealth: ({ server }: State) => server.connectionHealth ?? HEALTHY_CONNECTION_HEALTH,
  getIsServerUnresponsive: ({ server }: State) => (server.connectionHealth?.missedPongs ?? 0) > 0,
  getConnectUnreachable: ({ server }: State) => server.connectUnreachable ?? false,
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
  getLogs: ({ server }: State) => server.logs,
  getBackendDecks: ({ server }: State) => server.backendDecks,
  getDownloadedDeck: ({ server }: State) => server.downloadedDeck,
  getDownloadedReplay: ({ server }: State) => server.downloadedReplay,
  getRegistrationError: ({ server }: State) => server.registrationError,
  getSortUsersBy: ({ server }: State) => server.sortUsersBy,

  // Private-message history with a specific user. Both directions
  // (sent + received) are stored under the OTHER user's name — the
  // reducer keys on `sender === self ? receiver : sender` — so a
  // single lookup returns the full conversation. Returns a stable
  // empty array when there's no history yet so callers can rely on
  // referential equality in memoized selectors.
  getPrivateMessagesForUser: ({ server }: State, userName: string): Event_UserMessage[] =>
    server.messages[userName] ?? EMPTY_MESSAGES,

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
}
