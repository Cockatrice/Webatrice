import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_JoinGame_ext, Command_JoinGameSchema, Response_ResponseCode } from '../../generated';
import type { JoinGameParams } from '../../generated';
import type { RequestId } from '../../types/RequestId';
import { outlivedSession } from '../outlivedSession';

const ERROR_CODES = [
  Response_ResponseCode.RespNotInRoom,
  Response_ResponseCode.RespNameNotFound,
  Response_ResponseCode.RespGameFull,
  Response_ResponseCode.RespWrongPassword,
  Response_ResponseCode.RespSpectatorsNotAllowed,
  Response_ResponseCode.RespOnlyBuddies,
  Response_ResponseCode.RespUserLevelTooLow,
  Response_ResponseCode.RespInIgnoreList,
];

export function joinGame(roomId: number, joinGameParams: JoinGameParams, ...correlation: [requestId?: RequestId]): void {
  const response = WebClient.instance.response.room;
  response.setJoinGamePending(true, ...correlation);

  const onResponseCode: { [code: number]: () => void } = {
    // Match desktop default:; — acknowledge silently, no user dialog.
    [Response_ResponseCode.RespContextError]: () => response.setJoinGamePending(false, ...correlation),
  };
  for (const code of ERROR_CODES) {
    onResponseCode[code] = () => {
      if (correlation.length) {
        response.setJoinGameError(code, '', undefined, ...correlation);
      } else {
        response.setJoinGameError(code, '');
      }
    };
  }

  WebClient.instance.protobuf.sendRoomCommand(
    roomId,
    Command_JoinGame_ext,
    create(Command_JoinGameSchema, joinGameParams),
    {
      onSuccess: () => {
        response.setJoinGamePending(false, ...correlation);
        response.joinedGame(roomId, joinGameParams.gameId, ...correlation);
      },
      onResponseCode,
      onError: (_responseCode, _raw, failure) => {
        if (outlivedSession(failure)) {
          return;
        }
        if (failure) {
          response.setJoinGameError(Response_ResponseCode.RespNotConnected, '', failure, ...correlation);
        } else {
          response.setJoinGamePending(false, ...correlation);
        }
      },
    },
  );
}
