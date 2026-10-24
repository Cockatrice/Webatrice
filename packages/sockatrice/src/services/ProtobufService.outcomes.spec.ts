
import { create, toBinary } from '@bufbuild/protobuf';
import type { GenExtension } from '@bufbuild/protobuf/codegenv2';

import { DEFAULT_COMMAND_TIMEOUT_MS, LATENCY_STATS_INTERVAL_MS, ProtobufService } from './ProtobufService';
import { CommandFailure } from './command-options';
import {
  Command_Ping_ext,
  CommandContainerSchema,
  Response_ResponseCode,
  ResponseSchema,
  ServerMessageSchema,
  ServerMessage_MessageType,
  type SessionCommand,
} from '../generated';

let socket: { isOpen: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };

const makeService = (timeoutMs?: number) =>
  new ProtobufService(socket, { game: [], room: [], session: [] }, timeoutMs);

const pingExt = Command_Ping_ext as GenExtension<SessionCommand, unknown>;

function deliverResponse(service: ProtobufService, cmdId: number, responseCode = Response_ResponseCode.RespOk): void {
  const message = create(ServerMessageSchema, {
    messageType: ServerMessage_MessageType.RESPONSE,
    response: create(ResponseSchema, { cmdId: BigInt(cmdId), responseCode }),
  });
  service.handleMessageEvent({ data: toBinary(ServerMessageSchema, message).buffer } as MessageEvent);
}

beforeEach(() => {
  vi.useFakeTimers();
  socket = { isOpen: vi.fn().mockReturnValue(true), send: vi.fn() };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('command deadline', () => {
  it('defaults to desktop\'s (timeout + 1) * keepalive at default settings', () => {
    expect(DEFAULT_COMMAND_TIMEOUT_MS).toBe((5 + 1) * 3000);
  });

  it('fails an unanswered command with Timeout once the default deadline passes', () => {
    const service = makeService();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError });

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS - 1);
    expect(onError).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      Response_ResponseCode.RespNotConnected,
      expect.objectContaining({ cmdId: 1n, responseCode: Response_ResponseCode.RespNotConnected }),
      CommandFailure.Timeout,
    );
  });

  it('honours a service-level default deadline', () => {
    const service = makeService(500);
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError });

    vi.advanceTimersByTime(500);
    expect(onError).toHaveBeenCalledWith(Response_ResponseCode.RespNotConnected, expect.anything(), CommandFailure.Timeout);
  });

  it('lets a command override the deadline through its options', () => {
    const service = makeService();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError, timeoutMs: 60_000 });

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(onError).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60_000 - DEFAULT_COMMAND_TIMEOUT_MS);
    expect(onError).toHaveBeenCalledWith(Response_ResponseCode.RespNotConnected, expect.anything(), CommandFailure.Timeout);
  });

  it('routes the failure through an onResponseCode[RespNotConnected] handler first, as desktop\'s switch would', () => {
    const service = makeService();
    const notConnected = vi.fn();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, {
      onError,
      onResponseCode: { [Response_ResponseCode.RespNotConnected]: notConnected },
    });

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(notConnected).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('never reports a timeout to onResponse or onSuccess', () => {
    const service = makeService();
    const onResponse = vi.fn();
    const onSuccess = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onResponse });
    service.sendSessionCommand(pingExt, {}, { onSuccess });

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(onResponse).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('clears the deadline when the response arrives in time', () => {
    const service = makeService();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onSuccess, onError });

    deliverResponse(service, 1);
    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS * 2);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a response that arrives after the command timed out', () => {
    const service = makeService();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onSuccess, onError });

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    deliverResponse(service, 1);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('a late response for an expired command does not settle a newer command', () => {
    const service = makeService();
    const first = { onSuccess: vi.fn(), onError: vi.fn() };
    const second = { onSuccess: vi.fn(), onError: vi.fn() };
    service.sendSessionCommand(pingExt, {}, first);
    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    service.sendSessionCommand(pingExt, {}, second);

    deliverResponse(service, 1);
    expect(second.onSuccess).not.toHaveBeenCalled();

    deliverResponse(service, 2);
    expect(second.onSuccess).toHaveBeenCalledTimes(1);
    expect(first.onSuccess).not.toHaveBeenCalled();
  });

  it('expires each command on its own deadline', () => {
    const service = makeService(1000);
    const early = vi.fn();
    const late = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError: early });
    vi.advanceTimersByTime(400);
    service.sendSessionCommand(pingExt, {}, { onError: late });

    vi.advanceTimersByTime(600);
    expect(early).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it('a command sent without options expires silently', () => {
    const service = makeService();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    service.sendSessionCommand(pingExt, {});

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(warn).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    warn.mockRestore();
  });

  it('warns when a failure has nobody to report to', () => {
    const service = makeService();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    service.sendSessionCommand(pingExt, {}, { onSuccess: vi.fn() });

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(CommandFailure.Timeout));
    warn.mockRestore();
  });
});

describe('connection reset', () => {
  it('fails every in-flight command with Disconnected, once each', () => {
    const service = makeService();
    const a = vi.fn();
    const b = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError: a });
    service.sendSessionCommand(pingExt, {}, { onError: b });

    service.resetCommands();

    expect(a).toHaveBeenCalledWith(
      Response_ResponseCode.RespNotConnected,
      expect.objectContaining({ cmdId: 1n }),
      CommandFailure.Disconnected,
    );
    expect(b).toHaveBeenCalledWith(
      Response_ResponseCode.RespNotConnected,
      expect.objectContaining({ cmdId: 2n }),
      CommandFailure.Disconnected,
    );

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not fail a command that already timed out', () => {
    const service = makeService();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError });

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    service.resetCommands();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.anything(), expect.anything(), CommandFailure.Timeout);
  });

  it('keeps command identities distinct across re-entrant resets', () => {
    const service = makeService();
    const resend = vi.fn(() => service.sendSessionCommand(pingExt, {}, { onSuccess: vi.fn() }));
    service.sendSessionCommand(pingExt, {}, { onError: resend });

    service.resetCommands();

    expect(resend).toHaveBeenCalledTimes(1);
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError });
    service.resetCommands();
    expect(onError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cmdId: 3n }), CommandFailure.Disconnected);
  });

  it('tolerates a re-entrant reset from inside a failure callback', () => {
    const service = makeService();
    const second = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError: () => service.resetCommands() });
    service.sendSessionCommand(pingExt, {}, { onError: second });

    expect(() => service.resetCommands()).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores a response for a command that was failed by the reset', () => {
    const service = makeService();
    const onSuccess = vi.fn();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onSuccess, onError });

    service.resetCommands();
    deliverResponse(service, 1);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('unsent command', () => {
  it('fails immediately with NotSent and arms no deadline', () => {
    socket.isOpen.mockReturnValue(false);
    const service = makeService();
    const onError = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError });

    expect(onError).toHaveBeenCalledWith(
      Response_ResponseCode.RespNotConnected,
      expect.objectContaining({ responseCode: Response_ResponseCode.RespNotConnected }),
      CommandFailure.NotSent,
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('raw sendCommand', () => {
  it('reports the failure reason to its onFailure callback', () => {
    const service = makeService();
    const onResponse = vi.fn();
    const onFailure = vi.fn();
    service.sendCommand(create(CommandContainerSchema), onResponse, onFailure, 100);

    vi.advanceTimersByTime(100);
    expect(onFailure).toHaveBeenCalledWith(CommandFailure.Timeout);
    expect(onResponse).not.toHaveBeenCalled();
  });
});

describe('reset isolation', () => {
  it('cancels all deadlines before a throwing callback and still settles its siblings', () => {
    const service = makeService();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const timersSeen: number[] = [];
    const second = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onError: () => {
      timersSeen.push(vi.getTimerCount());
      throw new Error('consumer failed');
    } });
    service.sendSessionCommand(pingExt, {}, { onError: second });
    expect(() => service.resetCommands()).not.toThrow();
    expect(timersSeen).toEqual([0]);
    expect(second).toHaveBeenCalledExactlyOnceWith(
      Response_ResponseCode.RespNotConnected, expect.anything(), CommandFailure.Disconnected,
    );
    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(second).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('does not let an old response settle the first command after a reset', () => {
    const service = makeService();
    service.sendSessionCommand(pingExt, {}, { onError: vi.fn() });
    service.resetCommands();
    const success = vi.fn();
    service.sendSessionCommand(pingExt, {}, { onSuccess: success });
    deliverResponse(service, 1);
    expect(success).not.toHaveBeenCalled();
    deliverResponse(service, 2);
    expect(success).toHaveBeenCalledTimes(1);
  });
});

describe('round-trip timing', () => {
  const makeTimedService = (onLatencyStats: ReturnType<typeof vi.fn>) =>
    new ProtobufService(socket, { game: [], room: [], session: [] }, undefined, onLatencyStats);

  it('times an answered command from send to response', () => {
    const onLatencyStats = vi.fn();
    const service = makeTimedService(onLatencyStats);
    service.sendSessionCommand(pingExt, {});

    vi.advanceTimersByTime(120);
    deliverResponse(service, 1);

    expect(onLatencyStats).toHaveBeenCalledWith(
      { lastMs: 120, medianMs: 120, p95Ms: 120, maxMs: 120, sampleCount: 1 },
      [120],
    );
  });

  it('pushes stats at most once per interval while still recording every sample', () => {
    const onLatencyStats = vi.fn();
    const service = makeTimedService(onLatencyStats);

    service.sendSessionCommand(pingExt, {});
    vi.advanceTimersByTime(10);
    deliverResponse(service, 1);
    service.sendSessionCommand(pingExt, {});
    vi.advanceTimersByTime(30);
    deliverResponse(service, 2);
    expect(onLatencyStats).toHaveBeenCalledTimes(1);

    service.sendSessionCommand(pingExt, {});
    vi.advanceTimersByTime(LATENCY_STATS_INTERVAL_MS);
    deliverResponse(service, 3);
    expect(onLatencyStats).toHaveBeenCalledTimes(2);
    expect(onLatencyStats).toHaveBeenLastCalledWith(
      expect.objectContaining({ sampleCount: 3, lastMs: LATENCY_STATS_INTERVAL_MS }),
      [10, 30, LATENCY_STATS_INTERVAL_MS],
    );
  });

  it('records nothing for a command that times out', () => {
    const onLatencyStats = vi.fn();
    const service = makeTimedService(onLatencyStats);
    service.sendSessionCommand(pingExt, {});

    vi.advanceTimersByTime(DEFAULT_COMMAND_TIMEOUT_MS);
    deliverResponse(service, 1);

    expect(onLatencyStats).not.toHaveBeenCalled();
  });

  it('clears the window and pushes zeroed stats on reset', () => {
    const onLatencyStats = vi.fn();
    const service = makeTimedService(onLatencyStats);
    service.sendSessionCommand(pingExt, {});
    vi.advanceTimersByTime(50);
    deliverResponse(service, 1);

    service.resetCommands();
    expect(onLatencyStats).toHaveBeenLastCalledWith(
      { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 },
      [],
    );

    service.sendSessionCommand(pingExt, {});
    vi.advanceTimersByTime(70);
    deliverResponse(service, 2);
    expect(onLatencyStats).toHaveBeenLastCalledWith(expect.objectContaining({ sampleCount: 1, lastMs: 70 }), [70]);
  });
});
