// KeepAliveService timing scenarios — ping loop, pong correlation, timeout.

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

  it('disconnects with a timeout status when a ping goes unanswered', () => {
    connectRaw();

    vi.advanceTimersByTime(5000);
    expect(() => findLastSessionCommand(Data.Command_Ping_ext)).not.toThrow();
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.CONNECTED);

    vi.advanceTimersByTime(5000);

    expect(getMockWebSocket().close).toHaveBeenCalled();
    expect(getWebClient().status).toBe(WebsocketTypes.StatusEnum.DISCONNECTED);
  });
});
