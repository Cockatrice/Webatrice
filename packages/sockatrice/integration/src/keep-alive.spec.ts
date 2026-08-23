// KeepAliveService timing scenarios — ping loop, pong correlation, silence policy.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { WebsocketTypes } from '../../src/types';

import {
  connectRaw,
  getMockWebSocket,
  getMockWorker,
  getMockWorkerArgs,
  getWebClient,
  installMockWorker,
  uninstallMockWorker,
} from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

describe('keep-alive', () => {
  beforeAll(() => {
    installMockWorker();
  });

  afterAll(() => {
    uninstallMockWorker();
  });

  it('drives ping timing through a Worker pointing at the keepAliveWorker entrypoint', () => {
    connectRaw();

    const args = getMockWorkerArgs();
    expect(args.url).toBeInstanceOf(URL);
    expect((args.url as URL).pathname).toMatch(/keepAliveWorker\.(js|ts)$/);
    expect(args.options).toEqual({ type: 'module' });

    const worker = getMockWorker();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'start', interval: 5000 });
    expect(worker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));

    vi.advanceTimersByTime(5000);
    const ping = findLastSessionCommand(Data.Command_Ping_ext);
    expect(ping.cmdId).toBeGreaterThan(0);
  });

  it('sends a Command_Ping on every keepalive interval tick', () => {
    connectRaw();

    expect(() => findLastSessionCommand(Data.Command_Ping_ext)).toThrow();

    vi.advanceTimersByTime(5000);
    const first = findLastSessionCommand(Data.Command_Ping_ext);
    expect(first.cmdId).toBeGreaterThan(0);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: first.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    vi.advanceTimersByTime(5000);
    const second = findLastSessionCommand(Data.Command_Ping_ext);
    expect(second.cmdId).toBeGreaterThan(first.cmdId);
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.CONNECTED);
  });

  it('stays CONNECTED while pongs arrive before the next tick', () => {
    connectRaw();

    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(5000);
      const ping = findLastSessionCommand(Data.Command_Ping_ext);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: ping.cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
      })));
    }

    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.CONNECTED);
    expect(getMockWebSocket().close).not.toHaveBeenCalled();
  });

  it('never closes the connection on unanswered pings — keeps pinging through sustained silence', () => {
    connectRaw();

    vi.advanceTimersByTime(5000);
    const first = findLastSessionCommand(Data.Command_Ping_ext);
    expect(first.cmdId).toBeGreaterThan(0);
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.CONNECTED);

    // The keepalive never closes the connection under sustained silence — see
    // sockatrice-transport.instructions.md § keep-alive worker.
    vi.advanceTimersByTime(5000 * 6);

    expect(getMockWebSocket().close).not.toHaveBeenCalled();
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.CONNECTED);
    // Pings keep flowing so a recovering server still hears from us.
    const last = findLastSessionCommand(Data.Command_Ping_ext);
    expect(last.cmdId).toBeGreaterThan(first.cmdId);
  });
});
