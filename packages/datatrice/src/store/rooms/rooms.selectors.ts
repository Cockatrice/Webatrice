import { createSelector } from '@reduxjs/toolkit';
import { Enriched } from '../../types';
import { ServerInfo_User, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { SortUtil } from '../../common';
import { GameFilters, RoomsState } from './rooms.interfaces';
import { ServerState } from '../server/server.interfaces';
import {
  DEFAULT_GAME_FILTERS,
  GameFilterContext,
  gameMatchesFilters,
  isGameFiltersAtDefaults,
} from './gameFilters';

type State = {
  rooms: RoomsState;
  server?: ServerState;
};

const EMPTY_GAMES: Enriched.Game[] = [];
const EMPTY_USERS: ServerInfo_User[] = [];
const EMPTY_GAMES_MAP: { [id: number]: Enriched.Game } = {};
const EMPTY_USERS_MAP: { [name: string]: ServerInfo_User } = {};

const ZERO_COUNTS = { visible: 0, total: 0 };

export const Selectors = {
  getRooms: ({ rooms }: State) => rooms.rooms,
  getRoom: ({ rooms }: State, id: number) => rooms.rooms[id],
  getJoinedRoomIds: ({ rooms }: State) => rooms.joinedRoomIds,
  getJoinedGameIds: ({ rooms }: State) => rooms.joinedGameIds,
  getMessages: ({ rooms }: State) => rooms.messages,
  getSortGamesBy: ({ rooms: { sortGamesBy } }: State) => sortGamesBy,
  getSortUsersBy: ({ rooms: { sortUsersBy } }: State) => sortUsersBy,

  getJoinedRooms: createSelector(
    [(state: State) => state.rooms.rooms, (state: State) => state.rooms.joinedRoomIds],
    (rooms, joined) => Object.values(rooms).filter(room => joined[room.info.roomId])
  ),

  getJoinedGames: createSelector(
    [
      (state: State, roomId: number) => state.rooms.rooms[roomId]?.games,
      (state: State, roomId: number) => state.rooms.joinedGameIds[roomId],
    ],
    (games, joined): Enriched.Game[] => {
      if (!games || !joined) {
        return EMPTY_GAMES;
      }
      return Object.values(games).filter(game => joined[game.info.gameId]);
    }
  ),

  getRoomMessages: (state: State, roomId: number) => state.rooms.messages[roomId],

  getRoomGames: (state: State, roomId: number) => state.rooms.rooms[roomId]?.games ?? EMPTY_GAMES_MAP,

  getRoomUsers: (state: State, roomId: number) => state.rooms.rooms[roomId]?.users ?? EMPTY_USERS_MAP,

  getSortedRoomGames: createSelector(
    [
      (state: State, roomId: number) => state.rooms.rooms[roomId]?.games,
      (state: State) => state.rooms.sortGamesBy,
    ],
    (games, sortBy): Enriched.Game[] => {
      if (!games) {
        return EMPTY_GAMES;
      }
      return SortUtil.sortedByField(Object.values(games), sortBy);
    }
  ),

  getSortedRoomUsers: createSelector(
    [
      (state: State, roomId: number) => state.rooms.rooms[roomId]?.users,
      (state: State) => state.rooms.sortUsersBy,
    ],
    (users, sortBy): ServerInfo_User[] => {
      if (!users) {
        return EMPTY_USERS;
      }
      return SortUtil.sortedUsersByField(Object.values(users), sortBy);
    }
  ),

  getSelectedGameId: (state: State, roomId: number): number | undefined =>
    state.rooms.selectedGameIds?.[roomId],

  getGameFilters: (state: State, roomId: number): GameFilters =>
    state.rooms.gameFilters?.[roomId] ?? DEFAULT_GAME_FILTERS,

  isGameFilterActive: (state: State, roomId: number): boolean => {
    const filters = state.rooms.gameFilters?.[roomId];
    if (!filters) {
      return false;
    }
    return !isGameFiltersAtDefaults(filters);
  },

  getJoinGamePending: ({ rooms }: State) => rooms.joinGamePending,
  getJoinGameError: ({ rooms }: State) => rooms.joinGameError,

  getFilteredRoomGames: createSelector(
    [
      (state: State, roomId: number) => state.rooms.rooms[roomId]?.games,
      (state: State) => state.rooms.sortGamesBy,
      (state: State, roomId: number) => state.rooms.gameFilters?.[roomId],
      (state: State) => state.server?.user,
      (state: State) => state.server?.buddyList,
      (state: State) => state.server?.ignoreList,
    ],
    (games, sortBy, filters, user, buddyList, ignoreList): Enriched.Game[] => {
      if (!games) {
        return EMPTY_GAMES;
      }
      const sorted = SortUtil.sortedByField(Object.values(games), sortBy);
      if (!filters || isGameFiltersAtDefaults(filters)) {
        return sorted;
      }
      const ctx: GameFilterContext = {
        isOwnUserRegistered: user
          ? (user.userLevel & ServerInfo_User_UserLevelFlag.IsRegistered) ===
            ServerInfo_User_UserLevelFlag.IsRegistered
          : false,
        isUserBuddy: (name) => Boolean(buddyList?.[name]),
        isUserIgnored: (name) => Boolean(ignoreList?.[name]),
        nowSeconds: Math.floor(Date.now() / 1000),
      };
      return sorted.filter((game) => gameMatchesFilters(game, filters, ctx));
    }
  ),

  getRoomGameCounts: createSelector(
    [
      (state: State, roomId: number) => state.rooms.rooms[roomId]?.games,
      (state: State, roomId: number) => state.rooms.gameFilters?.[roomId],
      (state: State) => state.server?.user,
      (state: State) => state.server?.buddyList,
      (state: State) => state.server?.ignoreList,
    ],
    (games, filters, user, buddyList, ignoreList): { visible: number; total: number } => {
      if (!games) {
        return ZERO_COUNTS;
      }
      const all = Object.values(games);
      const total = all.length;
      if (!filters || isGameFiltersAtDefaults(filters)) {
        return { visible: total, total };
      }
      const ctx: GameFilterContext = {
        isOwnUserRegistered: user
          ? (user.userLevel & ServerInfo_User_UserLevelFlag.IsRegistered) ===
            ServerInfo_User_UserLevelFlag.IsRegistered
          : false,
        isUserBuddy: (name) => Boolean(buddyList?.[name]),
        isUserIgnored: (name) => Boolean(ignoreList?.[name]),
        nowSeconds: Math.floor(Date.now() / 1000),
      };
      const visible = all.reduce((n, game) => (gameMatchesFilters(game, filters, ctx) ? n + 1 : n), 0);
      return { visible, total };
    }
  ),
}
