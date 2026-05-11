import { create, setExtension, toBinary } from '@bufbuild/protobuf';
import type { GenExtension, GenMessage } from '@bufbuild/protobuf/codegenv2';
import type { MessageInitShape } from '@bufbuild/protobuf';

import { Data } from '@app/types';

import { getMockWebSocket } from './setup';

export function make<S extends GenMessage<any>>(
  schema: S,
  init?: MessageInitShape<S>
): ReturnType<typeof create<S>> {
  return create(schema, init);
}

export function buildResponseMessage(response: Data.Response): Uint8Array {
  const msg = create(Data.ServerMessageSchema, {
    messageType: Data.ServerMessage_MessageType.RESPONSE,
    response,
  });
  return toBinary(Data.ServerMessageSchema, msg);
}

export function buildResponse<V>(params: {
  cmdId: number;
  responseCode?: Data.Response_ResponseCode;
  ext?: GenExtension<Data.Response, V>;
  value?: V;
}): Data.Response {
  const response = create(Data.ResponseSchema, {
    cmdId: BigInt(params.cmdId),
    responseCode: params.responseCode ?? Data.Response_ResponseCode.RespOk,
  });
  if (params.ext && params.value !== undefined) {
    setExtension(response, params.ext, params.value);
  }
  return response;
}

export function buildSessionEventMessage<V>(
  ext: GenExtension<Data.SessionEvent, V>,
  value: V
): Uint8Array {
  const sessionEvent = create(Data.SessionEventSchema);
  setExtension(sessionEvent, ext, value);
  const msg = create(Data.ServerMessageSchema, {
    messageType: Data.ServerMessage_MessageType.SESSION_EVENT,
    sessionEvent,
  });
  return toBinary(Data.ServerMessageSchema, msg);
}

export function buildRoomEventMessage<V>(
  roomId: number,
  ext: GenExtension<Data.RoomEvent, V>,
  value: V
): Uint8Array {
  const roomEvent = create(Data.RoomEventSchema, { roomId });
  setExtension(roomEvent, ext, value);
  const msg = create(Data.ServerMessageSchema, {
    messageType: Data.ServerMessage_MessageType.ROOM_EVENT,
    roomEvent,
  });
  return toBinary(Data.ServerMessageSchema, msg);
}

export function buildGameEventMessage<V>(
  params: {
    gameId: number;
    playerId?: number;
    ext: GenExtension<Data.GameEvent, V>;
    value: V;
  }
): Uint8Array {
  const gameEvent = create(Data.GameEventSchema, {
    playerId: params.playerId ?? -1,
  });
  setExtension(gameEvent, params.ext, params.value);
  const container = create(Data.GameEventContainerSchema, {
    gameId: params.gameId,
    eventList: [gameEvent],
  });
  const msg = create(Data.ServerMessageSchema, {
    messageType: Data.ServerMessage_MessageType.GAME_EVENT_CONTAINER,
    gameEventContainer: container,
  });
  return toBinary(Data.ServerMessageSchema, msg);
}

export function deliverMessage(binary: Uint8Array): void {
  const mock = getMockWebSocket();
  const event = { data: binary.buffer } as MessageEvent;
  mock.onmessage?.(event);
}
