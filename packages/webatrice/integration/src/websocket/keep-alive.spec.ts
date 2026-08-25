// KeepAliveService timing scenarios — ping loop, pong correlation, timeout.

import { describe, expect, it } from 'vitest';

import { Command_Ping_ext, Response_ResponseCode } from '@cockatrice/sockatrice/generated';
import { store } from '../helpers/setup';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

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

  it('stays connected through sustained silence, reporting degraded health instead of closing', () => {
    connectRaw();

    vi.advanceTimersByTime(5000);
    expect(() => findLastSessionCommand(Command_Ping_ext)).not.toThrow();
    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.CONNECTED);
    expect(store.getState().server.connectionHealth.missedPongs).toBe(0);

    // Silence only degrades health; the keepalive never closes the connection —
    // see sockatrice-transport.instructions.md § keep-alive worker.
    vi.advanceTimersByTime(5000 * 6);
    expect(getMockWebSocket().close).not.toHaveBeenCalled();
    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.CONNECTED);
    expect(store.getState().server.connectionHealth.missedPongs).toBeGreaterThanOrEqual(2);
    expect(store.getState().server.connectionHealth.silentForMs).toBeGreaterThan(0);

    // Pings keep flowing so a recovering server still hears from us.
    const lastPing = findLastSessionCommand(Command_Ping_ext);
    expect(lastPing.cmdId).toBeGreaterThan(1);
  });

  it('reports recovery and clears degraded health when a delayed pong arrives', () => {
    connectRaw();

    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(5000);
    expect(store.getState().server.connectionHealth.missedPongs).toBeGreaterThanOrEqual(2);

    // The latest ping finally gets its response: proof of life.
    const ping = findLastSessionCommand(Command_Ping_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: ping.cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    expect(store.getState().server.connectionHealth.missedPongs).toBe(0);
    expect(getMockWebSocket().close).not.toHaveBeenCalled();
    expect(store.getState().server.status.state).toBe(WebsocketTypes.StatusEnum.CONNECTED);
  });
});
