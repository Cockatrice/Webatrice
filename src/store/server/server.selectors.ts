import { createSelector } from '@reduxjs/toolkit';
import { Data } from '../../types';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { SortUtil } from '../../common';
import { ServerState } from './server.interfaces';

type State = { server: ServerState };

const EMPTY_USERS: Data.ServerInfo_User[] = [];
const EMPTY_REPLAYS: Data.ServerInfo_ReplayMatch[] = [];

export const Selectors = {
  getInitialized: ({ server }: State) => server.initialized,
  getMessage: ({ server }: State) => server.info.message,
  getName: ({ server }: State) => server.info.name,
  getVersion: ({ server }: State) => server.info.version,
  getDescription: ({ server }: State) => server.status.description,
  getState: ({ server }: State) => server.status.state,
  getConnectionAttemptMade: ({ server }: State) => server.status.connectionAttemptMade,
  getTestConnectionStatus: ({ server }: State) => server.testConnectionStatus,
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
      const mask = Data.ServerInfo_User_UserLevelFlag.IsModerator;
      return (user.userLevel & mask) === mask;
    }
  ),

  getIsUserJudge: createSelector(
    [({ server }: State) => server.user],
    (user): boolean => {
      if (!user) {
        return false;
      }
      const mask = Data.ServerInfo_User_UserLevelFlag.IsJudge;
      return (user.userLevel & mask) === mask;
    }
  ),

  getIsUserRegistered: createSelector(
    [({ server }: State) => server.user],
    (user): boolean => {
      if (!user) {
        return false;
      }
      const mask = Data.ServerInfo_User_UserLevelFlag.IsRegistered;
      return (user.userLevel & mask) === mask;
    }
  ),
  getUserInfoByName: ({ server }: State, userName: string): Data.ServerInfo_User | undefined =>
    server.userInfo[userName],
  getLogs: ({ server }: State) => server.logs,
  getBackendDecks: ({ server }: State) => server.backendDecks,
  getDownloadedDeck: ({ server }: State) => server.downloadedDeck,
  getDownloadedReplay: ({ server }: State) => server.downloadedReplay,
  getRegistrationError: ({ server }: State) => server.registrationError,
  getSortUsersBy: ({ server }: State) => server.sortUsersBy,

  getUsers: ({ server }: State) => server.users,
  getBuddyList: ({ server }: State) => server.buddyList,
  getIgnoreList: ({ server }: State) => server.ignoreList,
  getReplays: ({ server }: State) => server.replays,

  getSortedUsers: createSelector(
    [(state: State) => state.server.users, (state: State) => state.server.sortUsersBy],
    (users, sortBy): Data.ServerInfo_User[] => {
      if (!users || Object.keys(users).length === 0) {
        return EMPTY_USERS;
      }
      return SortUtil.sortedUsersByField(Object.values(users), sortBy);
    }
  ),

  getSortedBuddyList: createSelector(
    [(state: State) => state.server.buddyList, (state: State) => state.server.sortUsersBy],
    (buddyList, sortBy): Data.ServerInfo_User[] => {
      if (!buddyList || Object.keys(buddyList).length === 0) {
        return EMPTY_USERS;
      }
      return SortUtil.sortedUsersByField(Object.values(buddyList), sortBy);
    }
  ),

  getSortedIgnoreList: createSelector(
    [(state: State) => state.server.ignoreList, (state: State) => state.server.sortUsersBy],
    (ignoreList, sortBy): Data.ServerInfo_User[] => {
      if (!ignoreList || Object.keys(ignoreList).length === 0) {
        return EMPTY_USERS;
      }
      return SortUtil.sortedUsersByField(Object.values(ignoreList), sortBy);
    }
  ),

  getReplaysList: createSelector(
    [(state: State) => state.server.replays],
    (replays): Data.ServerInfo_ReplayMatch[] => {
      if (!replays || Object.keys(replays).length === 0) {
        return EMPTY_REPLAYS;
      }
      return Object.values(replays).sort((a, b) => a.gameId - b.gameId);
    }
  ),
}
