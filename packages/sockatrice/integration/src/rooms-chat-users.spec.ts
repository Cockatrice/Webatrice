import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';
import * as Data from '../../src/generated';
import { RoomCommands, SessionCommands } from '../../src';
import { DEFAULT_COMMAND_TIMEOUT_MS } from '../../src/services/ProtobufService';
import { WebsocketTypes } from '../../src/types';
import { connectAndLogin, getMockResponse, getWebClient, getMockWebSocket } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { captureAllOutbound, findLastRoomCommand, findLastSessionCommand } from '../../src/testing/command-capture';

const Code = Data.Response_ResponseCode;
function answer(cmdId: number, responseCode: Data.Response_ResponseCode): void {
  deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
}

describe('room and chat command outcomes', () => {
  it.each([false, true])('deduplicates an autojoin and preserves user initiation %s through healing', (userInitiated) => {
    connectAndLogin();
    SessionCommands.joinRoom(7, false);
    const first = findLastSessionCommand(Data.Command_JoinRoom_ext);
    expect({ ...first.value }).toEqual({ $typeName: first.value.$typeName, roomId: 7 });
    const count = captureAllOutbound().length;
    SessionCommands.joinRoom(7, userInitiated);
    expect(captureAllOutbound()).toHaveLength(count);
    answer(first.cmdId, Code.RespContextError);
    const leave = findLastRoomCommand(Data.Command_LeaveRoom_ext);
    const retry = findLastSessionCommand(Data.Command_JoinRoom_ext);
    expect(leave.roomId).toBe(7);
    expect({ ...leave.value }).toEqual({ $typeName: leave.value.$typeName });
    expect({ ...retry.value }).toEqual({ $typeName: retry.value.$typeName, roomId: 7 });
    expect(leave.cmdId).toBeLessThan(retry.cmdId);
    expect(captureAllOutbound()).toHaveLength(count + 2);
    answer(leave.cmdId, Code.RespContextError);
    expect(getMockResponse().room.joinRoomFailed).not.toHaveBeenCalled();
    answer(retry.cmdId, Code.RespContextError);
    expect(getMockResponse().room.joinRoomFailed).toHaveBeenCalledExactlyOnceWith(7, Code.RespContextError, undefined, userInitiated);
    SessionCommands.joinRoom(7);
    expect(captureAllOutbound()).toHaveLength(count + 3);
  });

  it('settles a join with missing room info without publishing a room', () => {
    connectAndLogin();
    SessionCommands.joinRoom(7);
    const first = findLastSessionCommand(Data.Command_JoinRoom_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: first.cmdId, responseCode: Code.RespOk,
      ext: Data.Response_JoinRoom_ext, value: create(Data.Response_JoinRoomSchema),
    })));
    expect(getMockResponse().room.joinRoom).not.toHaveBeenCalled();
    SessionCommands.joinRoom(7);
    const second = findLastSessionCommand(Data.Command_JoinRoom_ext);
    expect(second.cmdId).not.toBe(first.cmdId);
    expect({ ...second.value }).toEqual({ $typeName: second.value.$typeName, roomId: 7 });
  });

  it.each([
    Code.RespWrongPassword, Code.RespContextError, Code.RespInternalError,
  ])('settles an uncorrelated game join rejection %s', (code) => {
    connectAndLogin();
    RoomCommands.joinGame(7, { gameId: 42, password: 'secret', spectator: true });
    const sent = findLastRoomCommand(Data.Command_JoinGame_ext);
    expect(sent.roomId).toBe(7);
    expect({ ...sent.value }).toEqual({ $typeName: sent.value.$typeName, gameId: 42, password: 'secret', spectator: true });
    expect(getMockResponse().room.setJoinGamePending).toHaveBeenCalledExactlyOnceWith(true);
    answer(sent.cmdId, code);
    if (code === Code.RespWrongPassword) {
      expect(getMockResponse().room.setJoinGameError).toHaveBeenCalledExactlyOnceWith(code, '');
      expect(getMockResponse().room.setJoinGamePending).toHaveBeenCalledTimes(1);
    } else {
      expect(getMockResponse().room.setJoinGameError).not.toHaveBeenCalled();
      expect(vi.mocked(getMockResponse().room.setJoinGamePending).mock.calls).toEqual([[true], [false]]);
    }
    expect(getMockResponse().room.joinedGame).not.toHaveBeenCalled();
  });

  it.each([Code.RespChatFlood, Code.RespInternalError, Code.RespOk])('reports only flood rejections for trimmed room chat: %s', (code) => {
    connectAndLogin();
    const before = captureAllOutbound().length;
    RoomCommands.roomSay(7, '   ');
    expect(captureAllOutbound()).toHaveLength(before);
    RoomCommands.roomSay(7, '  hello  ');
    const sent = findLastRoomCommand(Data.Command_RoomSay_ext);
    expect(sent.roomId).toBe(7);
    expect({ ...sent.value }).toEqual({ $typeName: sent.value.$typeName, message: 'hello' });
    answer(sent.cmdId, code);
    if (code === Code.RespChatFlood) {
      expect(getMockResponse().room.roomSayFailed).toHaveBeenCalledExactlyOnceWith(7, 'hello', code);
    } else {
      expect(getMockResponse().room.roomSayFailed).not.toHaveBeenCalled();
    }
  });

  it.each([
    { code: Code.RespInIgnoreList, behaviour: 'reports privateMessageFailed when ignored' },
    { code: Code.RespNameNotFound, behaviour: 'reports privateMessageFailed when the recipient is offline' },
    { code: Code.RespChatFlood, behaviour: 'reports privateMessageFailed when rate limited' },
    { code: Code.RespContextError, behaviour: 'stays silent on a context error' },
    { code: Code.RespOk, behaviour: 'stays silent on success' },
  ])('$behaviour', ({ code }) => {
    connectAndLogin();
    SessionCommands.message('bob', ' hello ');
    const sent = findLastSessionCommand(Data.Command_Message_ext);
    expect({ ...sent.value }).toEqual({ $typeName: sent.value.$typeName, userName: 'bob', message: ' hello ' });
    answer(sent.cmdId, code);
    if (code === Code.RespOk || code === Code.RespContextError) {
      expect(getMockResponse().session.privateMessageFailed).not.toHaveBeenCalled();
    } else {
      expect(getMockResponse().session.privateMessageFailed).toHaveBeenCalledExactlyOnceWith('bob', ' hello ', code);
    }
  });

  it.each([
    Code.RespNameNotFound, Code.RespInIgnoreList, Code.RespInternalError, Code.RespOk,
  ])('settles a games-of-user lookup with response %s', (code) => {
    connectAndLogin();
    SessionCommands.getGamesOfUser('bob');
    const sent = findLastSessionCommand(Data.Command_GetGamesOfUser_ext);
    expect({ ...sent.value }).toEqual({ $typeName: sent.value.$typeName, userName: 'bob' });
    expect(getMockResponse().session.getGamesOfUserPending).toHaveBeenCalledExactlyOnceWith('bob');
    const value = create(Data.Response_GetGamesOfUserSchema, { gameList: [create(Data.ServerInfo_GameSchema, { gameId: 42 })] });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: sent.cmdId, responseCode: code, ext: Data.Response_GetGamesOfUser_ext, value,
    })));
    if (code === Code.RespOk) {
      expect(getMockResponse().session.getGamesOfUser).toHaveBeenCalledExactlyOnceWith('bob', value);
      expect(getMockResponse().session.getGamesOfUserFailed).not.toHaveBeenCalled();
    } else {
      expect(getMockResponse().session.getGamesOfUserFailed).toHaveBeenCalledExactlyOnceWith('bob', code, undefined);
      expect(getMockResponse().session.getGamesOfUser).not.toHaveBeenCalled();
    }
  });

  it.each(['timeout', 'disconnect', 'reconnecting'] as const)('settles chat and lookup commands on %s', (outcome) => {
    connectAndLogin();
    RoomCommands.roomSay(7, ' hello ');
    SessionCommands.message('bob', 'hello');
    SessionCommands.getGamesOfUser('bob');
    SessionCommands.joinRoom(7);
    expect({ ...findLastRoomCommand(Data.Command_RoomSay_ext).value }).toEqual(create(Data.Command_RoomSaySchema, { message: 'hello' }));
    expect({ ...findLastSessionCommand(Data.Command_Message_ext).value }).toEqual(
      create(Data.Command_MessageSchema, { userName: 'bob', message: 'hello' }),
    );
    expect({ ...findLastSessionCommand(Data.Command_GetGamesOfUser_ext).value }).toEqual(
      create(Data.Command_GetGamesOfUserSchema, { userName: 'bob' }),
    );
    expect({ ...findLastSessionCommand(Data.Command_JoinRoom_ext).value }).toEqual(create(Data.Command_JoinRoomSchema, { roomId: 7 }));
    if (outcome === 'disconnect') {
      getWebClient().disconnect();
    } else if (outcome === 'reconnecting') {
      const socket = getMockWebSocket();
      socket.readyState = 3;
      socket.onclose?.({ code: 1006, reason: '', wasClean: false } as CloseEvent);
    } else {
      vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    }
    const response = getMockResponse();
    if (outcome === 'disconnect') {
      expect(response.room.roomSayFailed).not.toHaveBeenCalled();
      expect(response.session.privateMessageFailed).not.toHaveBeenCalled();
      expect(response.session.getGamesOfUserFailed).not.toHaveBeenCalled();
      expect(response.room.joinRoomFailed).not.toHaveBeenCalled();
    } else {
      const failure = outcome === 'timeout' ? WebsocketTypes.CommandFailure.Timeout : WebsocketTypes.CommandFailure.Disconnected;
      expect(response.room.roomSayFailed).toHaveBeenCalledExactlyOnceWith(7, 'hello', Code.RespNotConnected, failure);
      expect(response.session.privateMessageFailed).toHaveBeenCalledExactlyOnceWith('bob', 'hello', Code.RespNotConnected, failure);
      expect(response.session.getGamesOfUserFailed).toHaveBeenCalledExactlyOnceWith('bob', Code.RespNotConnected, failure);
      expect(response.room.joinRoomFailed).toHaveBeenCalledExactlyOnceWith(7, Code.RespNotConnected, failure, true);
    }
  });
});
