
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { SessionCommands } from '../../src';
import { WebsocketTypes } from '../../src/types';

import {
  connectRaw,
  getMockResponse,
  getMockWebSocket,
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

describe('round-trip latency', () => {
  beforeAll(() => {
    installMockWorker();
  });

  afterAll(() => {
    uninstallMockWorker();
  });

  it('evicts old round trips after 64 samples and publishes the retained window in chronological order', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      connectRaw();
      const answered = vi.fn();
      const { updateLatencyStats } = getMockResponse().session;
      for (const duration of [2000, 5, 3, ...Array<number>(62).fill(1), 1000]) {
        SessionCommands.ping(answered);
        const ping = findLastSessionCommand(Data.Command_Ping_ext);
        expect({ ...ping.value }).toEqual({ $typeName: 'Command_Ping' });
        expect(ping.container.sessionCommand).toHaveLength(1);
        vi.advanceTimersByTime(duration);
        deliverMessage(buildResponseMessage(buildResponse({ cmdId: ping.cmdId })));
      }
      expect(getMockWebSocket().send.mock.calls).toHaveLength(66);
      expect(answered.mock.calls).toEqual(Array.from({ length: 66 }, () => []));
      expect(vi.mocked(updateLatencyStats!).mock.calls).toEqual([
        [{ lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 }, []],
        [{ lastMs: 2000, medianMs: 2000, p95Ms: 2000, maxMs: 2000, sampleCount: 1 }, [2000]],
        [
          { lastMs: 1000, medianMs: 1, p95Ms: 1, maxMs: 1000, sampleCount: 64 },
          [3, ...Array<number>(62).fill(1), 1000],
        ],
      ]);
      expect(error.mock.calls).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });

  it('reports the keepalive ping round trip and zeroes it on disconnect', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      connectRaw();

      vi.advanceTimersByTime(5000);
      const ping = findLastSessionCommand(Data.Command_Ping_ext);
      vi.advanceTimersByTime(85);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: ping.cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
      })));

      getWebClient().updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED);
      const { updateLatencyStats } = getMockResponse().session;
      expect(vi.mocked(updateLatencyStats!).mock.calls).toEqual([
        [{ lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 }, []],
        [{ lastMs: 85, medianMs: 85, p95Ms: 85, maxMs: 85, sampleCount: 1 }, [85]],
        [{ lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 }, []],
      ]);
      expect(error.mock.calls).toEqual([]);
    } finally {
      error.mockRestore();
    }
  });
});
