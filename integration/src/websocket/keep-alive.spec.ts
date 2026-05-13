// KeepAliveService timing scenarios â€” ping loop, pong correlation, timeout.

import { describe, expect, it } from 'vitest';

import { Command_Ping_ext, Response_ResponseCode } from 'sockatrice/generated';
import { store } from '../helpers/setup';
import { WebsocketTypes } from 'sockatrice/types';

import { connectRaw, getMockWebSocket } from '../helpers/setup';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../helpers/protobuf-builders';
import { findLastSessionCommand } from '../helpers/command-capture';

describe('keep-alive', () => {
  it('sends a Command_Ping on every keepalive interval tick', () => {
    connectRaw();

    expect(() => findLastSessionCommand(Command_Ping_ext)).toThrow();

    vi.advanceTimersByTime(5000);
    const first = findLastSessionCommand(Command_Ping_ext);
    expect(first.cmdId).toBeGreaterThan(0);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: first.cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    vi.advanceTimersByTime(5000);
    const second = findLastSessionCommand(Command_Ping_ext);
    expect(second.cmdId).toBeGreaterThan(first.cmdId);
    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.CONNECTED);
  });

  it('stays CONNECTED while pongs arrive before the next tick', () => {
    connectRaw();

    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(5000);
      const ping = findLastSessionCommand(Command_Ping_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: ping.cmdId,
        responseCode: Response_ResponseCode.RespOk,
      })));
    }

    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.CONNECTED);
    expect(getMockWebSocket().close).not.toHaveBeenCalled();
  });

  it('disconnects with a timeout status when a ping goes unanswered', () => {
    connectRaw();

    vi.advanceTimersByTime(5000);
    expect(() => findLastSessionCommand(Command_Ping_ext)).not.toThrow();
    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.CONNECTED);

    vi.advanceTimersByTime(5000);

    expect(getMockWebSocket().close).toHaveBeenCalled();
    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });
});
