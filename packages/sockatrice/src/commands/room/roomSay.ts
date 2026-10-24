import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_RoomSay_ext, Command_RoomSaySchema, Response_ResponseCode } from '../../generated';
import { outlivedSession } from '../outlivedSession';

export function roomSay(roomId: number, message: string): void {
  const trimmed = message.trim();

  if (!trimmed) {
    return;
  }

  const { room } = WebClient.instance.response;
  WebClient.instance.protobuf.sendRoomCommand(roomId, Command_RoomSay_ext, create(Command_RoomSaySchema, { message: trimmed }), {
    onResponseCode: {
      [Response_ResponseCode.RespChatFlood]: () => room.roomSayFailed?.(roomId, trimmed, Response_ResponseCode.RespChatFlood),
    },
    onError: (responseCode, _raw, failure) => {
      if (failure && !outlivedSession(failure)) {
        room.roomSayFailed?.(roomId, trimmed, responseCode, failure);
      }
    },
  });
}
