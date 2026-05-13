import { ServerInfo_User } from 'sockatrice/generated';
import { GameSortField, SortDirection, UserSortField } from 'datatrice';
import { WebsocketTypes } from 'sockatrice/types';
import type { RootState } from '../store';

function makeUser(overrides: Partial<ServerInfo_User> = {}): ServerInfo_User {
  return {
    name: 'testUser',
    realName: '',
    country: 'us',
    userLevel: 0,
    avatarBmp: new Uint8Array(),
    accountageSecs: BigInt(0),
    $typeName: 'ServerInfo_User' as any,
    $unknown: undefined,
    gender: 0,
    ...overrides,
  } as ServerInfo_User;
}

export const disconnectedState: Partial<RootState> = {
  server: {
    initialized: false,
    testConnectionStatus: null,
    buddyList: {},
    ignoreList: {},
    status: {
      connectionAttemptMade: false,
      state: WebsocketTypes.StatusEnum.DISCONNECTED,
      description: null,
    },
    info: { message: null, name: null, version: null },
    logs: { room: [], game: [], chat: [] },
    user: null,
    users: {},
    sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
    messages: {},
    userInfo: {},
    notifications: [],
    serverShutdown: null,
    banUser: '',
    banHistory: {},
    warnHistory: {},
    warnListOptions: [],
    warnUser: '',
    adminNotes: {},
    replays: {},
    backendDecks: null,
    downloadedDeck: null,
    downloadedReplay: null,
    gamesOfUser: {},
    registrationError: null,
  },
  rooms: {
    rooms: {},
    joinedRoomIds: {},
    joinedGameIds: {},
    messages: {},
    sortGamesBy: { field: GameSortField.START_TIME, order: SortDirection.DESC },
    sortUsersBy: { field: UserSortField.NAME, order: SortDirection.ASC },
    selectedGameIds: {},
    gameFilters: {},
    joinGamePending: false,
    joinGameError: null,
  },
  games: { games: {} },
  action: { type: null, payload: null, meta: null, error: false, count: 0 },
};

export const connectedState: Partial<RootState> = {
  ...disconnectedState,
  server: {
    ...(disconnectedState.server as any),
    initialized: true,
    status: {
      connectionAttemptMade: true,
      state: WebsocketTypes.StatusEnum.LOGGED_IN,
      description: null,
    },
    info: {
      message: '<b>Welcome</b>',
      name: 'Test Server',
      version: '1.0.0',
    },
    user: makeUser(),
    users: {
      testUser: makeUser(),
    },
  },
};

export const connectedWithRoomsState: Partial<RootState> = {
  ...connectedState,
  server: {
    ...(connectedState.server as any),
    users: {
      testUser: makeUser(),
      otherUser: makeUser({ name: 'otherUser' }),
    },
  },
  rooms: {
    ...(disconnectedState.rooms as any),
    rooms: {
      1: {
        info: { roomId: 1, name: 'Main Room', description: 'The main room', autoJoin: true, permissionLevel: 0 },
        gameList: [],
        userList: [makeUser(), makeUser({ name: 'otherUser' })],
      },
    },
    joinedRoomIds: { 1: true },
    messages: {
      1: [],
    },
  },
};

export { makeUser };

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export function makeStoreState(partial: DeepPartial<RootState>): Partial<RootState> {
  return partial as Partial<RootState>;
}
