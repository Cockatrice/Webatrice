vi.mock('../../WebClient');

import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { WebClient } from '../../WebClient';
import {
  Command_CreateGame_ext,
  Command_CreateGameSchema,
  Command_JoinGame_ext,
  Command_JoinGameSchema,
  Command_LeaveRoom_ext,
  Command_RoomSay_ext,
  Response_ResponseCode,
} from '../../generated';

import { createGame } from './createGame';
import { joinGame } from './joinGame';
import { leaveRoom } from './leaveRoom';
import { roomSay } from './roomSay';
import { create } from '@bufbuild/protobuf';
import { CommandFailure } from '../../types/CommandFailure';
import { StatusEnum } from '../../types/StatusEnum';
import { Mock } from 'vitest';

const { invokeOnSuccess, invokeResponseCode, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendRoomCommand as Mock,
  // sendRoomCommand(roomId, ext, value, options) — options at index 3
  3
);

describe('createGame', () => {

  it('calls sendRoomCommand with Command_CreateGame', () => {
    createGame(5, create(Command_CreateGameSchema, { maxPlayers: 4 }));
    expect(WebClient.instance.protobuf.sendRoomCommand).toHaveBeenCalledWith(
      5, Command_CreateGame_ext, expect.objectContaining({ maxPlayers: 4 }), expect.any(Object)
    );
  });

  it('onSuccess calls response.room.gameCreated with roomId', () => {
    createGame(5, create(Command_CreateGameSchema, {}));
    invokeOnSuccess();
    expect(WebClient.instance.response.room.gameCreated).toHaveBeenCalledWith(5);
  });

  it('onError reports the failure with roomId, code and transport reason', () => {
    createGame(5, create(Command_CreateGameSchema, {}));
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.room.createGameFailed).toHaveBeenCalledWith(
      5, Response_ResponseCode.RespNotConnected, CommandFailure.Timeout,
    );
  });

  it('onError reports a server rejection without a transport reason', () => {
    createGame(5, create(Command_CreateGameSchema, {}));
    invokeOnError(Response_ResponseCode.RespContextError);
    expect(WebClient.instance.response.room.createGameFailed).toHaveBeenCalledWith(
      5, Response_ResponseCode.RespContextError, undefined,
    );
  });
});

describe('joinGame', () => {
  beforeEach(() => {
    (WebClient.instance.response.room.joinedGame as Mock).mockClear();
    (WebClient.instance.response.room.setJoinGamePending as Mock).mockClear();
    (WebClient.instance.response.room.setJoinGameError as Mock).mockClear();
  });

  it('calls sendRoomCommand with Command_JoinGame', () => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42, password: '' }));
    expect(WebClient.instance.protobuf.sendRoomCommand).toHaveBeenCalledWith(
      7, Command_JoinGame_ext, expect.objectContaining({ gameId: 42, password: '' }), expect.any(Object)
    );
  });

  it('dispatches setJoinGamePending(true) before sending', () => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }));
    expect(WebClient.instance.response.room.setJoinGamePending).toHaveBeenCalledWith(true);
  });

  it('onSuccess clears pending and calls response.room.joinedGame with roomId and gameId', () => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }));
    invokeOnSuccess();
    expect(WebClient.instance.response.room.setJoinGamePending).toHaveBeenLastCalledWith(false);
    expect(WebClient.instance.response.room.joinedGame).toHaveBeenCalledWith(7, 42);
  });

  const errorCodes = [
    Response_ResponseCode.RespNotInRoom, Response_ResponseCode.RespNameNotFound,
    Response_ResponseCode.RespGameFull, Response_ResponseCode.RespWrongPassword,
    Response_ResponseCode.RespSpectatorsNotAllowed, Response_ResponseCode.RespOnlyBuddies,
    Response_ResponseCode.RespUserLevelTooLow, Response_ResponseCode.RespInIgnoreList,
  ];
  it.each(errorCodes)('code %i reaches the UI without protocol-owned presentation text', (code) => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }));
    invokeResponseCode(code);
    expect(WebClient.instance.response.room.setJoinGameError).toHaveBeenCalledWith(code, '');
    expect(WebClient.instance.response.room.joinedGame).not.toHaveBeenCalled();
  });

  it('code 11 (RespContextError) is silent — clears pending, no setJoinGameError, no console.error', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }));
    invokeResponseCode(Response_ResponseCode.RespContextError);
    expect(WebClient.instance.response.room.setJoinGameError).not.toHaveBeenCalled();
    expect(WebClient.instance.response.room.setJoinGamePending).toHaveBeenLastCalledWith(false);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('unknown response code goes to onError — clears pending, no setJoinGameError', () => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }));
    invokeOnError(99);
    expect(WebClient.instance.response.room.setJoinGameError).not.toHaveBeenCalled();
    expect(WebClient.instance.response.room.setJoinGamePending).toHaveBeenLastCalledWith(false);
  });

  it.each([CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'a %s failure carries its reason for UI translation', (failure) => {
      WebClient.instance.status = StatusEnum.RECONNECTING;
      joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }));
      invokeOnError(Response_ResponseCode.RespNotConnected, {}, failure);
      expect(WebClient.instance.response.room.setJoinGameError).toHaveBeenCalledWith(
        Response_ResponseCode.RespNotConnected, '', failure,
      );
    },
  );
});

describe('leaveRoom', () => {

  it('calls sendRoomCommand with Command_LeaveRoom', () => {
    leaveRoom(3);
    expect(WebClient.instance.protobuf.sendRoomCommand).toHaveBeenCalledWith(
      3, Command_LeaveRoom_ext, expect.any(Object), expect.any(Object)
    );
  });

  it('onSuccess calls response.room.leaveRoom with roomId', () => {
    leaveRoom(3);
    invokeOnSuccess();
    expect(WebClient.instance.response.room.leaveRoom).toHaveBeenCalledWith(3);
  });
});

describe('roomSay', () => {

  it('calls sendRoomCommand with trimmed message', () => {
    roomSay(2, '  hello  ');
    expect(WebClient.instance.protobuf.sendRoomCommand).toHaveBeenCalledWith(
      2,
      Command_RoomSay_ext,
      expect.objectContaining({ message: 'hello' }),
      expect.any(Object),
    );
  });

  it('does not call sendRoomCommand when message is blank', () => {
    roomSay(2, '   ');
    expect(WebClient.instance.protobuf.sendRoomCommand).not.toHaveBeenCalled();
  });

  it('does not call sendRoomCommand when message is empty string', () => {
    roomSay(2, '');
    expect(WebClient.instance.protobuf.sendRoomCommand).not.toHaveBeenCalled();
  });

  it('reports a flood rejection with the unsent message', () => {
    roomSay(2, '  hello  ');
    invokeResponseCode(Response_ResponseCode.RespChatFlood);
    expect(WebClient.instance.response.room.roomSayFailed).toHaveBeenCalledWith(2, 'hello', Response_ResponseCode.RespChatFlood);
  });

  it('reports a message the server never answered with the transport reason', () => {
    WebClient.instance.status = StatusEnum.RECONNECTING;
    roomSay(2, 'hello');
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    WebClient.instance.status = StatusEnum.DISCONNECTED;
    expect(WebClient.instance.response.room.roomSayFailed).toHaveBeenCalledWith(
      2, 'hello', Response_ResponseCode.RespNotConnected, CommandFailure.Disconnected,
    );
  });

  it('does not report a message failed because the session ended, whose state is already reset', () => {
    WebClient.instance.status = StatusEnum.DISCONNECTED;
    roomSay(2, 'hello');
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(WebClient.instance.response.room.roomSayFailed).not.toHaveBeenCalled();
  });

  it('keeps other server rejections silent, as desktop does', () => {
    roomSay(2, 'hello');
    invokeOnError(Response_ResponseCode.RespContextError);
    expect(WebClient.instance.response.room.roomSayFailed).not.toHaveBeenCalled();
  });
});
