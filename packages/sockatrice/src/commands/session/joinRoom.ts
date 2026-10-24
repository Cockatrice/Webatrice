import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import {
  Command_JoinRoom_ext,
  Command_JoinRoomSchema,
  Command_LeaveRoom_ext,
  Command_LeaveRoomSchema,
  Response_JoinRoom_ext,
  Response_ResponseCode,
} from '../../generated';
import { outlivedSession } from '../outlivedSession';
import { pendingRoomJoins as pendingJoins } from './pendingRoomJoins';

export function joinRoom(roomId: number, userInitiated = true): void {
  if (pendingJoins.has(roomId)) {
    if (userInitiated) {
      pendingJoins.set(roomId, true);
    }
    return;
  }
  pendingJoins.set(roomId, userInitiated);
  sendJoinRoom(roomId, false);
}

function sendJoinRoom(roomId: number, isHealingRejoin: boolean): void {
  const settle = (): boolean => {
    const userInitiated = pendingJoins.get(roomId) ?? false;
    pendingJoins.delete(roomId);
    return userInitiated;
  };

  WebClient.instance.protobuf.sendSessionCommand(Command_JoinRoom_ext, create(Command_JoinRoomSchema, { roomId }), {
    responseExt: Response_JoinRoom_ext,
    onSuccess: (response) => {
      const userInitiated = settle();
      if (response.roomInfo) {
        WebClient.instance.response.room.joinRoom(response.roomInfo, userInitiated);
      }
    },
    onResponseCode: {
      [Response_ResponseCode.RespContextError]: () => {
        if (isHealingRejoin) {
          WebClient.instance.response.room.joinRoomFailed?.(roomId, Response_ResponseCode.RespContextError, undefined, settle());
          return;
        }
        WebClient.instance.protobuf.sendRoomCommand(roomId, Command_LeaveRoom_ext, create(Command_LeaveRoomSchema), {
          onError: () => {},
        });
        sendJoinRoom(roomId, true);
      },
    },
    onError: (responseCode, _raw, failure) => {
      const userInitiated = settle();
      if (!outlivedSession(failure)) {
        WebClient.instance.response.room.joinRoomFailed?.(roomId, responseCode, failure, userInitiated);
      }
    },
  });
}
