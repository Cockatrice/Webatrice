vi.mock('../../WebClient');

import { create } from '@bufbuild/protobuf';
import type { Mock } from 'vitest';
import { WebClient } from '../../WebClient';
import { Command_JoinGameSchema, Response_ResponseCode, ResponseSchema } from '../../generated';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { CommandFailure } from '../../types/CommandFailure';
import { StatusEnum } from '../../types/StatusEnum';
import { joinGame } from './joinGame';

const { invokeOnSuccess, invokeResponseCode, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendRoomCommand as Mock, 3,
);

beforeEach(() => {
  WebClient.instance.status = StatusEnum.LOGGED_IN;
});

describe('join-game request ownership', () => {
  it('echoes the identity on pending and success without sending it over the wire', () => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }), 'join-a');
    expect(WebClient.instance.response.room.setJoinGamePending).toHaveBeenCalledWith(true, 'join-a');
    const command = vi.mocked(WebClient.instance.protobuf.sendRoomCommand).mock.calls[0][2];
    expect(command).not.toHaveProperty('requestId');
    invokeOnSuccess();
    expect(WebClient.instance.response.room.setJoinGamePending).toHaveBeenLastCalledWith(false, 'join-a');
    expect(WebClient.instance.response.room.joinedGame).toHaveBeenCalledWith(7, 42, 'join-a');
  });

  it.each([
    Response_ResponseCode.RespNotInRoom, Response_ResponseCode.RespNameNotFound,
    Response_ResponseCode.RespGameFull, Response_ResponseCode.RespWrongPassword,
    Response_ResponseCode.RespSpectatorsNotAllowed, Response_ResponseCode.RespOnlyBuddies,
    Response_ResponseCode.RespUserLevelTooLow, Response_ResponseCode.RespInIgnoreList,
  ])('echoes the identity on rejection %i', (code) => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }), 'join-a');
    invokeResponseCode(code);
    expect(WebClient.instance.response.room.setJoinGameError).toHaveBeenCalledWith(code, '', undefined, 'join-a');
  });

  it.each([CommandFailure.Timeout, CommandFailure.NotSent, CommandFailure.Disconnected])(
    'echoes the identity on a %s failure while the session state is retained', (failure) => {
      WebClient.instance.status = StatusEnum.RECONNECTING;
      joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }), 'join-a');
      invokeOnError(Response_ResponseCode.RespNotConnected, {}, failure);
      expect(WebClient.instance.response.room.setJoinGameError).toHaveBeenCalledWith(
        Response_ResponseCode.RespNotConnected, '', failure, 'join-a',
      );
    },
  );

  it.each([Response_ResponseCode.RespContextError, 99])('identifies a silent terminal response %i', (code) => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }), 'join-a');
    if (code === Response_ResponseCode.RespContextError) {
      invokeResponseCode(code);
    } else {
      invokeOnError(code);
    }
    expect(WebClient.instance.response.room.setJoinGamePending).toHaveBeenLastCalledWith(false, 'join-a');
    expect(WebClient.instance.response.room.setJoinGameError).not.toHaveBeenCalled();
  });

  it('keeps each request identity when the old rejection arrives after a new join', () => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }), 'join-old');
    const oldOptions = vi.mocked(WebClient.instance.protobuf.sendRoomCommand).mock.calls[0][3];
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }), 'join-new');
    invokeOnSuccess();
    oldOptions?.onResponseCode?.[Response_ResponseCode.RespWrongPassword]?.(create(ResponseSchema, {
      responseCode: Response_ResponseCode.RespWrongPassword,
    }));
    expect(WebClient.instance.response.room.joinedGame).toHaveBeenCalledWith(7, 42, 'join-new');
    expect(WebClient.instance.response.room.setJoinGameError).toHaveBeenCalledWith(
      Response_ResponseCode.RespWrongPassword, '', undefined, 'join-old',
    );
  });

  it('does not write an error or pending outcome after the session has reset', () => {
    joinGame(7, create(Command_JoinGameSchema, { gameId: 42 }), 'join-old');
    vi.mocked(WebClient.instance.response.room.setJoinGamePending).mockClear();
    WebClient.instance.status = StatusEnum.DISCONNECTED;
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(WebClient.instance.response.room.setJoinGameError).not.toHaveBeenCalled();
    expect(WebClient.instance.response.room.setJoinGamePending).not.toHaveBeenCalled();
  });
});
