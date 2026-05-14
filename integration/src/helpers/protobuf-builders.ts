import { create, setExtension, toBinary } from '@bufbuild/protobuf';
import type { GenExtension, GenMessage } from '@bufbuild/protobuf/codegenv2';
import type { MessageInitShape } from '@bufbuild/protobuf';

import { GameEvent, GameEventContainerSchema, GameEventSchema, Response, ResponseSchema, Response_ResponseCode, RoomEvent, RoomEventSchema, ServerMessageSchema, ServerMessage_MessageType, SessionEvent, SessionEventSchema } from '@cockatrice/sockatrice/generated';
import { getMockWebSocket } from './setup';

export function make<S extends GenMessage<any>>(
  schema: S,
  init?: MessageInitShape<S>
): ReturnType<typeof create<S>> {
  return create(schema, init);
}

export function buildResponseMessage(response: Response): Uint8Array {
  const msg = create(ServerMessageSchema, {
    messageType: ServerMessage_MessageType.RESPONSE,
    response,
  });
  return toBinary(ServerMessageSchema, msg);
}

export function buildResponse<V>(params: {
  cmdId: number;
  responseCode?: Response_ResponseCode;
  ext?: GenExtension<Response, V>;
  value?: V;
}): Response {
  const response = create(ResponseSchema, {
    cmdId: BigInt(params.cmdId),
    responseCode: params.responseCode ?? Response_ResponseCode.RespOk,
  });
  if (params.ext && params.value !== undefined) {
    setExtension(response, params.ext, params.value);
  }
  return response;
}

export function buildSessionEventMessage<V>(
  ext: GenExtension<SessionEvent, V>,
  value: V
): Uint8Array {
  const sessionEvent = create(SessionEventSchema);
  setExtension(sessionEvent, ext, value);
  const msg = create(ServerMessageSchema, {
    messageType: ServerMessage_MessageType.SESSION_EVENT,
    sessionEvent,
  });
  return toBinary(ServerMessageSchema, msg);
}

export function buildRoomEventMessage<V>(
  roomId: number,
  ext: GenExtension<RoomEvent, V>,
  value: V
): Uint8Array {
  const roomEvent = create(RoomEventSchema, { roomId });
  setExtension(roomEvent, ext, value);
  const msg = create(ServerMessageSchema, {
    messageType: ServerMessage_MessageType.ROOM_EVENT,
    roomEvent,
  });
  return toBinary(ServerMessageSchema, msg);
}

export function buildGameEventMessage<V>(
  params: {
    gameId: number;
    playerId?: number;
    ext: GenExtension<GameEvent, V>;
    value: V;
  }
): Uint8Array {
  const gameEvent = create(GameEventSchema, {
    playerId: params.playerId ?? -1,
  });
  setExtension(gameEvent, params.ext, params.value);
  const container = create(GameEventContainerSchema, {
    gameId: params.gameId,
    eventList: [gameEvent],
  });
  const msg = create(ServerMessageSchema, {
    messageType: ServerMessage_MessageType.GAME_EVENT_CONTAINER,
    gameEventContainer: container,
  });
  return toBinary(ServerMessageSchema, msg);
}

export function deliverMessage(binary: Uint8Array): void {
  const mock = getMockWebSocket();
  const event = { data: binary.buffer } as MessageEvent;
  mock.onmessage?.(event);
}
