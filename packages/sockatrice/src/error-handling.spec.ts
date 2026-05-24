// Cross-cutting error & chaos suite. The point of this file is to prove that
// the transport + protobuf stack stays in a consistent state when the world
// misbehaves: malformed bytes from the server, callbacks that throw, late
// responses arriving after a command was already errored, etc.
//
// Per-command unit tests for the happy path live next to their commands.
// `WebSocketService.spec.ts` and `ProtobufService.spec.ts` cover the normal
// flow plus the closed-transport cases. This file covers the cases that
// don't fit cleanly into either neighbour — they describe *what does not
// break the rest of the session* when something goes wrong.

import { create, toBinary } from '@bufbuild/protobuf';

import { ProtobufService, type EventRegistries } from './services/ProtobufService';
import {
  CommandContainerSchema,
  ResponseSchema,
  ServerMessageSchema,
  ServerMessage_MessageType,
  type Response,
} from './generated';

type ProtobufInternal = ProtobufService & {
  cmdId: number;
  pendingCommands: Map<number, (response: Response) => void>;
};

let mockSocket: { isOpen: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
let registries: EventRegistries;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

const makeService = () => new ProtobufService(mockSocket, registries);

beforeEach(() => {
  mockSocket = {
    isOpen: vi.fn().mockReturnValue(true),
    send: vi.fn(),
  };
  registries = { game: [], room: [], session: [] };

  // ProtobufService logs to console.error / console.warn on the unhappy
  // path. Suppress and assert.
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

describe('Malformed inbound frames', () => {
  it('non-protobuf bytes are swallowed; no throw and no callback fires', () => {
    const svc = makeService();
    const responseCb = vi.fn();
    const cmd = create(CommandContainerSchema);
    svc.sendCommand(cmd, responseCb);

    // Random non-proto bytes — fromBinary will throw or yield garbage.
    const garbage = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x42]);
    expect(() => svc.handleMessageEvent({ data: garbage.buffer } as MessageEvent)).not.toThrow();
    expect(responseCb).not.toHaveBeenCalled();
  });

  it('after a malformed frame the service still accepts a well-formed response', () => {
    const svc = makeService();
    const responseCb = vi.fn();
    const cmd = create(CommandContainerSchema);
    svc.sendCommand(cmd, responseCb);
    const sentCmdId = (svc as ProtobufInternal).cmdId;

    // First: garbage.
    svc.handleMessageEvent({ data: new Uint8Array([0xff, 0xff, 0xff]).buffer } as MessageEvent);

    // Then: a real correlated response.
    const goodResponse = create(ResponseSchema, { cmdId: BigInt(sentCmdId) });
    const goodMessage = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.RESPONSE,
      response: goodResponse,
    });
    const bytes = toBinary(ServerMessageSchema, goodMessage);
    svc.handleMessageEvent({ data: bytes.buffer } as MessageEvent);

    expect(responseCb).toHaveBeenCalledTimes(1);
  });
});

describe('Late & duplicate responses', () => {
  it('a response correlated to an unknown cmdId is silently dropped', () => {
    const svc = makeService();
    // Don't send anything; just inject a response with a made-up cmdId.
    const response = create(ResponseSchema, { cmdId: 99n });
    const message = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.RESPONSE,
      response,
    });
    expect(() => svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message).buffer,
    } as MessageEvent)).not.toThrow();
  });

  it('a duplicate response for the same cmdId fires the callback once', () => {
    const svc = makeService();
    const responseCb = vi.fn();
    svc.sendCommand(create(CommandContainerSchema), responseCb);
    const sentCmdId = (svc as ProtobufInternal).cmdId;

    const response = create(ResponseSchema, { cmdId: BigInt(sentCmdId) });
    const message = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.RESPONSE,
      response,
    });
    const bytes = toBinary(ServerMessageSchema, message).buffer;

    svc.handleMessageEvent({ data: bytes } as MessageEvent);
    svc.handleMessageEvent({ data: bytes } as MessageEvent);

    expect(responseCb).toHaveBeenCalledTimes(1);
  });

  it('resetCommands clears pending; a late response for a pre-reset cmdId is dropped', () => {
    const svc = makeService();
    const responseCb = vi.fn();
    svc.sendCommand(create(CommandContainerSchema), responseCb);
    const sentCmdId = (svc as ProtobufInternal).cmdId;

    svc.resetCommands();

    const response = create(ResponseSchema, { cmdId: BigInt(sentCmdId) });
    const message = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.RESPONSE,
      response,
    });
    svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message).buffer,
    } as MessageEvent);

    expect(responseCb).not.toHaveBeenCalled();
  });
});

describe('Empty / undefined event payloads', () => {
  it('a RoomEvent with no extension is ignored without crashing', () => {
    const svc = makeService();
    const message = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.ROOM_EVENT,
    });
    expect(() => svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message).buffer,
    } as MessageEvent)).not.toThrow();
  });

  it('a SessionEvent with no extension is ignored without crashing', () => {
    const svc = makeService();
    const message = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.SESSION_EVENT,
    });
    expect(() => svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message).buffer,
    } as MessageEvent)).not.toThrow();
  });

  it('a GameEventContainer with empty eventList is a no-op', () => {
    const svc = makeService();
    const message = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.GAME_EVENT_CONTAINER,
    });
    expect(() => svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message).buffer,
    } as MessageEvent)).not.toThrow();
  });

});

describe('Callback chaos', () => {
  it('a response callback that throws does not corrupt the pending map for the next command', () => {
    const svc = makeService();

    const throwingCb = vi.fn(() => {
      throw new Error('consumer bug');
    });
    svc.sendCommand(create(CommandContainerSchema), throwingCb);
    const firstCmdId = (svc as ProtobufInternal).cmdId;

    const message1 = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.RESPONSE,
      response: create(ResponseSchema, { cmdId: BigInt(firstCmdId) }),
    });

    // handleMessageEvent has a try/catch around the whole flow; the throw
    // propagates into that catch and is logged. The next sendCommand path
    // must still work.
    expect(() => svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message1).buffer,
    } as MessageEvent)).not.toThrow();
    expect(throwingCb).toHaveBeenCalledTimes(1);

    // Second command — registry must still be clean enough to register a new pending entry.
    const goodCb = vi.fn();
    svc.sendCommand(create(CommandContainerSchema), goodCb);
    const secondCmdId = (svc as ProtobufInternal).cmdId;

    const message2 = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.RESPONSE,
      response: create(ResponseSchema, { cmdId: BigInt(secondCmdId) }),
    });
    svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message2).buffer,
    } as MessageEvent);

    expect(goodCb).toHaveBeenCalledTimes(1);
  });
});

describe('Rapid send race', () => {
  it('many sendCommand calls in a row yield monotonically increasing cmdIds with no collisions', () => {
    const svc = makeService();
    const cmdIds: number[] = [];

    for (let i = 0; i < 50; i++) {
      const cb = vi.fn();
      svc.sendCommand(create(CommandContainerSchema), cb);
      cmdIds.push((svc as ProtobufInternal).cmdId);
    }

    expect(cmdIds).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
    expect((svc as ProtobufInternal).pendingCommands.size).toBe(50);
  });

  it('after a response arrives, the pending entry is removed; the rest survive', () => {
    const svc = makeService();
    for (let i = 0; i < 5; i++) {
      svc.sendCommand(create(CommandContainerSchema), vi.fn());
    }

    const responseFor3 = create(ResponseSchema, { cmdId: 3n });
    const message = create(ServerMessageSchema, {
      messageType: ServerMessage_MessageType.RESPONSE,
      response: responseFor3,
    });
    svc.handleMessageEvent({
      data: toBinary(ServerMessageSchema, message).buffer,
    } as MessageEvent);

    const internal = svc as ProtobufInternal;
    expect(internal.pendingCommands.size).toBe(4);
    expect(internal.pendingCommands.has(3)).toBe(false);
    expect(internal.pendingCommands.has(1)).toBe(true);
    expect(internal.pendingCommands.has(5)).toBe(true);
  });
});
