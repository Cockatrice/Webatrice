import { App, Enriched } from '../../types';
import {
  Event_RoomSaySchema,
  ServerInfo_GameSchema,
  ServerInfo_RoomSchema,
  ServerInfo_User,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import type { MessageInitShape } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import { RoomsState } from '../../store/rooms/rooms.interfaces';

export function makeUser(
  overrides: MessageInitShape<typeof ServerInfo_UserSchema> = {}
): ServerInfo_User {
  return create(ServerInfo_UserSchema, {
    name: 'TestUser',
    accountageSecs: 0n,
    privlevel: '',
    userLevel: 0,
    ...overrides,
  });
}

type MakeGameOverrides = MessageInitShape<typeof ServerInfo_GameSchema> & {
  gameType?: string;
};

export function makeGame(overrides: MakeGameOverrides = {}): Enriched.Game {
  const { gameType = '', ...protoFields } = overrides;
  return {
    info: create(ServerInfo_GameSchema, {
      gameId: 1,
      roomId: 1,
      description: 'Test Game',
      gameTypes: [],
      started: false,
      ...protoFields,
    }),
    gameType,
  };
}

type MakeRoomOverrides = MessageInitShape<typeof ServerInfo_RoomSchema> & {
  gametypeMap?: Enriched.GametypeMap;
  order?: number;
  games?: { [gameId: number]: Enriched.Game };
  users?: { [userName: string]: ServerInfo_User };
};

export function makeRoom(overrides: MakeRoomOverrides = {}): Enriched.Room {
  const { gametypeMap = {}, order = 0, games = {}, users = {}, ...protoFields } = overrides;
  return {
    info: create(ServerInfo_RoomSchema, {
      roomId: 1,
      name: 'Test Room',
      description: '',
      gameCount: 0,
      gameList: [],
      gametypeList: [],
      autoJoin: false,
      playerCount: 0,
      userList: [],
      ...protoFields,
    }),
    gametypeMap,
    order,
    games,
    users,
  };
}

export function makeMessage(overrides: Partial<Omit<Enriched.Message, '$typeName' | '$unknown'>> = {}): Enriched.Message {
  const { timeReceived = 0, ...protoOverrides } = overrides;
  return {
    ...create(Event_RoomSaySchema, {
      message: 'hello',
      messageType: 0,
      ...protoOverrides,
    }),
    timeReceived,
  };
}

export function makeRoomsState(overrides: Partial<RoomsState> = {}): RoomsState {
  return {
    rooms: {
      1: makeRoom({ roomId: 1 }),
    },
    joinedRoomIds: {},
    joinedGameIds: {},
    messages: {},
    sortGamesBy: {
      field: App.GameSortField.START_TIME,
      order: App.SortDirection.DESC,
    },
    sortUsersBy: {
      field: App.UserSortField.NAME,
      order: App.SortDirection.ASC,
    },
    selectedGameIds: {},
    gameFilters: {},
    joinGamePending: false,
    joinGameError: null,
    ...overrides,
  };
}
