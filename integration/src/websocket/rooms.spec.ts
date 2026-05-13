import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import { Command_CreateGame_ext, Command_JoinGame_ext, Command_JoinRoom_ext, Command_LeaveRoom_ext, Command_RoomSay_ext, Event_JoinRoomSchema, Event_JoinRoom_ext, Event_LeaveRoomSchema, Event_LeaveRoom_ext, Event_ListGamesSchema, Event_ListGames_ext, Event_ListRoomsSchema, Event_ListRooms_ext, Event_RoomSaySchema, Event_RoomSay_RoomMessageType, Event_RoomSay_ext, Response_JoinRoomSchema, Response_JoinRoom_ext, Response_ResponseCode, ServerInfo_GameSchema, ServerInfo_Room, ServerInfo_RoomSchema, ServerInfo_UserSchema } from 'sockatrice/generated';
import { store } from '../helpers/setup';
import { RoomCommands } from 'sockatrice';

import { connectAndHandshake } from '../helpers/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildRoomEventMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../helpers/protobuf-builders';
import { findLastSessionCommand, findLastRoomCommand, captureAllOutbound } from '../helpers/command-capture';
import { fromBinary, hasExtension, getExtension } from '@bufbuild/protobuf';

function makeRoom(overrides: Partial<{
  roomId: number;
  name: string;
  autoJoin: boolean;
}> = {}): ServerInfo_Room {
  return create(ServerInfo_RoomSchema, {
    roomId: overrides.roomId ?? 1,
    name: overrides.name ?? 'Lobby',
    description: 'Test room',
    gameCount: 0,
    playerCount: 0,
    autoJoin: overrides.autoJoin ?? false,
    gameList: [],
    userList: [],
    gametypeList: [],
  });
}

function setupJoinedRoom(roomId = 1): void {
  deliverMessage(buildSessionEventMessage(
    Event_ListRooms_ext,
    create(Event_ListRoomsSchema, { roomList: [makeRoom({ roomId, autoJoin: true })] })
  ));
  const join = findLastSessionCommand(Command_JoinRoom_ext);
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: join.cmdId,
    responseCode: Response_ResponseCode.RespOk,
    ext: Response_JoinRoom_ext,
    value: create(Response_JoinRoomSchema, { roomInfo: makeRoom({ roomId }) }),
  })));
}

describe('rooms', () => {
  it('populates rooms state from Event_ListRooms', () => {
    connectAndHandshake();

    const listRooms = create(Event_ListRoomsSchema, {
      roomList: [
        makeRoom({ roomId: 1, name: 'Lobby' }),
        makeRoom({ roomId: 2, name: 'Legacy' }),
      ],
    });
    deliverMessage(buildSessionEventMessage(Event_ListRooms_ext, listRooms));

    const { rooms } = store.getState().rooms;
    expect(rooms[1]?.info?.name).toBe('Lobby');
    expect(rooms[2]?.info?.name).toBe('Legacy');
  });

  it('auto-joins rooms flagged with autoJoin and flips joinedRoomIds on Response_JoinRoom', () => {
    connectAndHandshake();

    const listRooms = create(Event_ListRoomsSchema, {
      roomList: [
        makeRoom({ roomId: 1, name: 'Lobby', autoJoin: true }),
        makeRoom({ roomId: 2, name: 'Legacy', autoJoin: false }),
      ],
    });
    deliverMessage(buildSessionEventMessage(Event_ListRooms_ext, listRooms));

    const join = findLastSessionCommand(Command_JoinRoom_ext);
    expect(join.value.roomId).toBe(1);

    const joined = create(Response_JoinRoomSchema, {
      roomInfo: makeRoom({ roomId: 1, name: 'Lobby' }),
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: join.cmdId,
      responseCode: Response_ResponseCode.RespOk,
      ext: Response_JoinRoom_ext,
      value: joined,
    })));

    expect(store.getState().rooms.joinedRoomIds[1]).toBe(true);
  });

  it('appends a room chat message on Event_RoomSay', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    const say = create(Event_RoomSaySchema, {
      name: 'bob',
      message: 'hello world',
      messageType: Event_RoomSay_RoomMessageType.UserMessage,
    });
    deliverMessage(buildRoomEventMessage(1, Event_RoomSay_ext, say));

    const messages = store.getState().rooms.messages[1];
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toBe('bob: hello world');
    expect(messages[0].name).toBe('bob');
  });

  it('updates the game list on Event_ListGames', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    const game = create(ServerInfo_GameSchema, {
      gameId: 42,
      description: 'Test Game',
      maxPlayers: 4,
      playerCount: 1,
      startTime: 1,
    });
    const listGames = create(Event_ListGamesSchema, { gameList: [game] });
    deliverMessage(buildRoomEventMessage(1, Event_ListGames_ext, listGames));

    const roomGames = store.getState().rooms.rooms[1]?.games;
    expect(roomGames).toBeDefined();
    expect(roomGames?.[42]?.info?.description).toBe('Test Game');
    expect(roomGames?.[42]?.info?.gameId).toBe(42);
  });

  it('auto-join filters correctly across multiple rooms', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Event_ListRooms_ext,
      create(Event_ListRoomsSchema, {
        roomList: [
          makeRoom({ roomId: 1, name: 'Lobby', autoJoin: true }),
          makeRoom({ roomId: 2, name: 'Legacy', autoJoin: false }),
          makeRoom({ roomId: 3, name: 'Modern', autoJoin: true }),
        ],
      })
    ));

    // Count outbound JoinRoom commands
    const containers = captureAllOutbound();
    const joinCommands: number[] = [];
    for (const container of containers) {
      for (const cmd of container.sessionCommand ?? []) {
        if (hasExtension(cmd, Command_JoinRoom_ext)) {
          joinCommands.push(getExtension(cmd, Command_JoinRoom_ext).roomId);
        }
      }
    }
    expect(joinCommands).toHaveLength(2);
    expect(joinCommands).toContain(1);
    expect(joinCommands).toContain(3);
    expect(joinCommands).not.toContain(2);
  });

  it('sends outbound Command_RoomSay with trimmed message', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    RoomCommands.roomSay(1, '  hello  ');

    const { value } = findLastRoomCommand(Command_RoomSay_ext);
    expect(value.message).toBe('hello');
  });

  it('removes room from joinedRoomIds on leaveRoom round-trip', () => {
    connectAndHandshake();
    setupJoinedRoom(1);
    expect(store.getState().rooms.joinedRoomIds[1]).toBe(true);

    RoomCommands.leaveRoom(1);

    const leave = findLastRoomCommand(Command_LeaveRoom_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: leave.cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    expect(store.getState().rooms.joinedRoomIds[1]).toBeUndefined();
  });

  it('tracks user join and leave within a room', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    deliverMessage(buildRoomEventMessage(1, Event_JoinRoom_ext, create(Event_JoinRoomSchema, {
      userInfo: create(ServerInfo_UserSchema, { name: 'bob' }),
    })));

    expect(store.getState().rooms.rooms[1]?.users?.bob).toBeDefined();

    deliverMessage(buildRoomEventMessage(1, Event_LeaveRoom_ext, create(Event_LeaveRoomSchema, {
      name: 'bob',
    })));

    expect(store.getState().rooms.rooms[1]?.users?.bob).toBeUndefined();
  });

  it('tracks game creation and join within a room', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    RoomCommands.createGame(1, { description: 'Casual', maxPlayers: 2 });

    const create_ = findLastRoomCommand(Command_CreateGame_ext);
    expect(create_.value.description).toBe('Casual');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: create_.cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    RoomCommands.joinGame(1, { gameId: 99 });

    const join = findLastRoomCommand(Command_JoinGame_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: join.cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    expect(store.getState().rooms.joinedGameIds[1]?.[99]).toBe(true);
  });
});