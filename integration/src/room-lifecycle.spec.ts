// Room lifecycle scenarios — end-to-end protocol wiring for room creation,
// player join/leave, game-start state progression, and room cleanup. These
// tests focus on the command/response/event round-trip rather than reducer
// semantics, which Datatrice owns.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { GameCommands, RoomCommands, SessionCommands } from '../../src';

import { connectAndHandshake, connectAndLogin, getMockResponse } from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildGameEventMessage,
  buildRoomEventMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import {
  findLastGameCommand,
  findLastRoomCommand,
  findLastSessionCommand,
} from '../../src/testing/command-capture';

function makeRoom(overrides: Partial<{
  roomId: number;
  name: string;
  autoJoin: boolean;
  gameCount: number;
  playerCount: number;
}> = {}): Data.ServerInfo_Room {
  return create(Data.ServerInfo_RoomSchema, {
    roomId: overrides.roomId ?? 1,
    name: overrides.name ?? 'Lobby',
    description: 'Lifecycle test room',
    gameCount: overrides.gameCount ?? 0,
    playerCount: overrides.playerCount ?? 0,
    autoJoin: overrides.autoJoin ?? false,
    gameList: [],
    userList: [],
    gametypeList: [],
  });
}

function joinDefaultRoom(roomId = 1): void {
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

describe('room lifecycle: create room → join → game starts → leave → cleanup', () => {
  it('host creates a room game via createGame, response triggers gameCreated dispatch', () => {
    connectAndLogin();
    joinDefaultRoom(1);

    RoomCommands.createGame(1, {
      description: 'Lifecycle Match',
      maxPlayers: 2,
      spectatorsAllowed: true,
    });

    const create_ = findLastRoomCommand(Data.Command_CreateGame_ext);
    expect(create_.value.description).toBe('Lifecycle Match');
    expect(create_.value.maxPlayers).toBe(2);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: create_.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().room.gameCreated).toHaveBeenCalledWith(1);
  });

  it('joinGame round-trip dispatches joinedGame, then Event_GameJoined drives session.gameJoined', () => {
    connectAndLogin();
    joinDefaultRoom(1);

    RoomCommands.joinGame(1, { gameId: 77, spectator: false });

    const join = findLastRoomCommand(Data.Command_JoinGame_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: join.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().room.joinedGame).toHaveBeenCalledWith(1, 77);

    deliverMessage(buildSessionEventMessage(
      Data.Event_GameJoined_ext,
      create(Data.Event_GameJoinedSchema, {
        gameInfo: create(Data.ServerInfo_GameSchema, {
          gameId: 77,
          description: 'Lifecycle Match',
          maxPlayers: 2,
          playerCount: 1,
        }),
        playerId: 1,
        hostId: 1,
        spectator: false,
        judge: false,
        resuming: false,
      })
    ));

    expect(getMockResponse().session.gameJoined).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 1,
        hostId: 1,
        gameInfo: expect.objectContaining({ gameId: 77 }),
      }),
    );
  });

  it('another player joins the room and the game; userJoined and playerJoined fire', () => {
    connectAndLogin();
    joinDefaultRoom(1);

    deliverMessage(buildRoomEventMessage(1, Data.Event_JoinRoom_ext, create(Data.Event_JoinRoomSchema, {
      userInfo: create(Data.ServerInfo_UserSchema, { name: 'bob' }),
    })));
    expect(getMockResponse().room.userJoined).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'bob' }),
    );

    deliverMessage(buildGameEventMessage({
      gameId: 77,
      playerId: 2,
      ext: Data.Event_Join_ext,
      value: create(Data.Event_JoinSchema, {
        playerProperties: create(Data.ServerInfo_PlayerPropertiesSchema, {
          playerId: 2,
          spectator: false,
          userInfo: create(Data.ServerInfo_UserSchema, { name: 'bob' }),
        }),
      }),
    }));
    expect(getMockResponse().game.playerJoined).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ playerId: 2 }),
    );
  });

  it('game starts: gameStateChanged with gameStarted=true dispatches game.gameStateChanged', () => {
    connectAndLogin();
    joinDefaultRoom(1);

    const player = create(Data.ServerInfo_PlayerSchema, {
      properties: create(Data.ServerInfo_PlayerPropertiesSchema, {
        playerId: 1,
        userInfo: create(Data.ServerInfo_UserSchema, { name: 'alice' }),
      }),
      zoneList: [],
      counterList: [],
      arrowList: [],
    });

    deliverMessage(buildGameEventMessage({
      gameId: 77,
      playerId: -1,
      ext: Data.Event_GameStateChanged_ext,
      value: create(Data.Event_GameStateChangedSchema, {
        playerList: [player],
        gameStarted: true,
        activePlayerId: 1,
        activePhase: 0,
      }),
    }));

    expect(getMockResponse().game.gameStateChanged).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ gameStarted: true, activePlayerId: 1 }),
    );
  });

  it('game-state progression: active player and phase changes propagate', () => {
    connectAndLogin();
    joinDefaultRoom(1);

    deliverMessage(buildGameEventMessage({
      gameId: 77,
      playerId: -1,
      ext: Data.Event_SetActivePlayer_ext,
      value: create(Data.Event_SetActivePlayerSchema, { activePlayerId: 2 }),
    }));
    expect(getMockResponse().game.activePlayerSet).toHaveBeenCalledWith(77, 2);

    deliverMessage(buildGameEventMessage({
      gameId: 77,
      playerId: -1,
      ext: Data.Event_SetActivePhase_ext,
      value: create(Data.Event_SetActivePhaseSchema, { phase: 3 }),
    }));
    expect(getMockResponse().game.activePhaseSet).toHaveBeenCalledWith(77, 3);
  });

  it('player leaves the game then leaves the room; playerLeft and userLeft dispatched', () => {
    connectAndLogin();
    joinDefaultRoom(1);

    GameCommands.leaveGame(77);
    expect(() => findLastGameCommand(Data.Command_LeaveGame_ext)).not.toThrow();

    deliverMessage(buildGameEventMessage({
      gameId: 77,
      playerId: 2,
      ext: Data.Event_Leave_ext,
      value: create(Data.Event_LeaveSchema, { reason: Data.Event_Leave_LeaveReason.USER_LEFT }),
    }));
    expect(getMockResponse().game.playerLeft).toHaveBeenCalledWith(
      77,
      2,
      expect.any(Number),
    );

    deliverMessage(buildRoomEventMessage(1, Data.Event_LeaveRoom_ext, create(Data.Event_LeaveRoomSchema, {
      name: 'bob',
    })));
    expect(getMockResponse().room.userLeft).toHaveBeenCalledWith(1, 'bob');
  });

  it('room cleanup: leaveRoom round-trip and gameClosed event clear the room/game', () => {
    connectAndLogin();
    joinDefaultRoom(1);

    deliverMessage(buildGameEventMessage({
      gameId: 77,
      playerId: -1,
      ext: Data.Event_GameClosed_ext,
      value: create(Data.Event_GameClosedSchema),
    }));
    expect(getMockResponse().game.gameClosed).toHaveBeenCalledWith(77);

    RoomCommands.leaveRoom(1);
    const leave = findLastRoomCommand(Data.Command_LeaveRoom_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: leave.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().room.leaveRoom).toHaveBeenCalledWith(1);
  });

  it('updateGames event refreshes the room game list during lifecycle', () => {
    connectAndHandshake();
    joinDefaultRoom(2);

    const game = create(Data.ServerInfo_GameSchema, {
      gameId: 77,
      description: 'Lifecycle Match',
      maxPlayers: 2,
      playerCount: 2,
      startTime: 1,
    });
    deliverMessage(buildRoomEventMessage(2, Data.Event_ListGames_ext, create(Data.Event_ListGamesSchema, {
      gameList: [game],
    })));

    expect(getMockResponse().room.updateGames).toHaveBeenCalledWith(
      2,
      expect.arrayContaining([expect.objectContaining({ gameId: 77, playerCount: 2 })]),
    );
  });

  it('session.userJoined and session.userLeft fire from server-level user events', () => {
    connectAndLogin();

    deliverMessage(buildSessionEventMessage(
      Data.Event_UserJoined_ext,
      create(Data.Event_UserJoinedSchema, {
        userInfo: create(Data.ServerInfo_UserSchema, { name: 'carol' }),
      })
    ));
    expect(getMockResponse().session.userJoined).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'carol' }),
    );

    deliverMessage(buildSessionEventMessage(
      Data.Event_UserLeft_ext,
      create(Data.Event_UserLeftSchema, { name: 'carol' })
    ));
    expect(getMockResponse().session.userLeft).toHaveBeenCalledWith('carol');
  });

  it('SessionCommands.listRooms sends Command_ListRooms (manual refresh path)', () => {
    connectAndLogin();

    SessionCommands.listRooms();

    expect(() => findLastSessionCommand(Data.Command_ListRooms_ext)).not.toThrow();
  });
});
