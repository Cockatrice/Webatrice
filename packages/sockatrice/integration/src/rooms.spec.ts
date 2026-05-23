// Room scenarios — Event_ListRooms handling, auto-join, Response_JoinRoom,
// room chat (inbound + outbound), game list updates, and leaveRoom.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import { hasExtension, getExtension } from '@bufbuild/protobuf';

import * as Data from '../../src/generated';
import { RoomCommands } from '../../src';

import { connectAndHandshake, getMockResponse } from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildRoomEventMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand, findLastRoomCommand, captureAllOutbound } from '../../src/testing/command-capture';

function makeRoom(overrides: Partial<{
  roomId: number;
  name: string;
  autoJoin: boolean;
}> = {}): Data.ServerInfo_Room {
  return create(Data.ServerInfo_RoomSchema, {
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

/** Deliver Event_ListRooms then join a single auto-join room. */
function setupJoinedRoom(roomId = 1): void {
  deliverMessage(buildSessionEventMessage(
    Data.Event_ListRooms_ext,
    create(Data.Event_ListRoomsSchema, { roomList: [makeRoom({ roomId, autoJoin: true })] })
  ));
  const join = findLastSessionCommand(Data.Command_JoinRoom_ext);
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: join.cmdId,
    responseCode: Data.Response_ResponseCode.RespOk,
    ext: Data.Response_JoinRoom_ext,
    value: create(Data.Response_JoinRoomSchema, { roomInfo: makeRoom({ roomId }) }),
  })));
}

describe('rooms', () => {
  it('dispatches updateRooms from Event_ListRooms', () => {
    connectAndHandshake();

    const listRooms = create(Data.Event_ListRoomsSchema, {
      roomList: [
        makeRoom({ roomId: 1, name: 'Lobby' }),
        makeRoom({ roomId: 2, name: 'Legacy' }),
      ],
    });
    deliverMessage(buildSessionEventMessage(Data.Event_ListRooms_ext, listRooms));

    expect(getMockResponse().room.updateRooms).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ roomId: 1, name: 'Lobby' }),
        expect.objectContaining({ roomId: 2, name: 'Legacy' }),
      ]),
    );
  });

  it('auto-joins rooms flagged with autoJoin and dispatches joinRoom on Response_JoinRoom', () => {
    connectAndHandshake();

    const listRooms = create(Data.Event_ListRoomsSchema, {
      roomList: [
        makeRoom({ roomId: 1, name: 'Lobby', autoJoin: true }),
        makeRoom({ roomId: 2, name: 'Legacy', autoJoin: false }),
      ],
    });
    deliverMessage(buildSessionEventMessage(Data.Event_ListRooms_ext, listRooms));

    const join = findLastSessionCommand(Data.Command_JoinRoom_ext);
    expect(join.value.roomId).toBe(1);

    const joined = create(Data.Response_JoinRoomSchema, {
      roomInfo: makeRoom({ roomId: 1, name: 'Lobby' }),
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: join.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_JoinRoom_ext,
      value: joined,
    })));

    expect(getMockResponse().room.joinRoom).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 1, name: 'Lobby' }),
    );
  });

  it('dispatches addMessage on Event_RoomSay', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    const say = create(Data.Event_RoomSaySchema, {
      name: 'bob',
      message: 'hello world',
      messageType: Data.Event_RoomSay_RoomMessageType.UserMessage,
    });
    deliverMessage(buildRoomEventMessage(1, Data.Event_RoomSay_ext, say));

    expect(getMockResponse().room.addMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'bob', message: 'hello world' }),
    );
  });

  it('dispatches updateGames on Event_ListGames', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    const game = create(Data.ServerInfo_GameSchema, {
      gameId: 42,
      description: 'Test Game',
      maxPlayers: 4,
      playerCount: 1,
      startTime: 1,
    });
    const listGames = create(Data.Event_ListGamesSchema, { gameList: [game] });
    deliverMessage(buildRoomEventMessage(1, Data.Event_ListGames_ext, listGames));

    expect(getMockResponse().room.updateGames).toHaveBeenCalledWith(
      1,
      expect.arrayContaining([expect.objectContaining({ gameId: 42, description: 'Test Game' })]),
    );
  });

  it('auto-join filters correctly across multiple rooms', () => {
    connectAndHandshake();

    deliverMessage(buildSessionEventMessage(
      Data.Event_ListRooms_ext,
      create(Data.Event_ListRoomsSchema, {
        roomList: [
          makeRoom({ roomId: 1, name: 'Lobby', autoJoin: true }),
          makeRoom({ roomId: 2, name: 'Legacy', autoJoin: false }),
          makeRoom({ roomId: 3, name: 'Modern', autoJoin: true }),
        ],
      })
    ));

    const containers = captureAllOutbound();
    const joinCommands: number[] = [];
    for (const container of containers) {
      for (const cmd of container.sessionCommand ?? []) {
        if (hasExtension(cmd, Data.Command_JoinRoom_ext)) {
          joinCommands.push(getExtension(cmd, Data.Command_JoinRoom_ext).roomId);
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

    const { value } = findLastRoomCommand(Data.Command_RoomSay_ext);
    expect(value.message).toBe('hello');
  });

  it('dispatches leaveRoom on leaveRoom round-trip', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    RoomCommands.leaveRoom(1);

    const leave = findLastRoomCommand(Data.Command_LeaveRoom_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: leave.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().room.leaveRoom).toHaveBeenCalledWith(1);
  });

  it('dispatches userJoined and userLeft within a room', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    deliverMessage(buildRoomEventMessage(1, Data.Event_JoinRoom_ext, create(Data.Event_JoinRoomSchema, {
      userInfo: create(Data.ServerInfo_UserSchema, { name: 'bob' }),
    })));
    expect(getMockResponse().room.userJoined).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'bob' }),
    );

    deliverMessage(buildRoomEventMessage(1, Data.Event_LeaveRoom_ext, create(Data.Event_LeaveRoomSchema, {
      name: 'bob',
    })));
    expect(getMockResponse().room.userLeft).toHaveBeenCalledWith(1, 'bob');
  });

  it('dispatches gameCreated and joinedGame within a room', () => {
    connectAndHandshake();
    setupJoinedRoom(1);

    RoomCommands.createGame(1, { description: 'Casual', maxPlayers: 2 });

    const create_ = findLastRoomCommand(Data.Command_CreateGame_ext);
    expect(create_.value.description).toBe('Casual');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: create_.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().room.gameCreated).toHaveBeenCalledWith(1);

    RoomCommands.joinGame(1, { gameId: 99 });

    const join = findLastRoomCommand(Data.Command_JoinGame_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: join.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().room.joinedGame).toHaveBeenCalledWith(1, 99);
  });
});
