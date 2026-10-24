import { create } from '@bufbuild/protobuf';
import { WebClient } from './WebClient';
import { Command_Ping_ext, Command_PingSchema } from './generated';
import { CommandFailure } from './types/CommandFailure';
import type { IWebClientResponse } from './types/WebClientResponse';
import { installMockWebSocketHarness } from './testing/mock-websocket';

let harness: ReturnType<typeof installMockWebSocketHarness>;
function response(): IWebClientResponse {
  return { session: {
    initialized: vi.fn(), connectionAttempted: vi.fn(), updateStatus: vi.fn(),
    connectionFailed: vi.fn(), connectionUnreachable: vi.fn(),
  } } as unknown as IWebClientResponse;
}
function client() {
  return new WebClient(response(), { clientid: 'test', clientver: 'test', clientfeatures: [] },
    { autojoinrooms: false, keepalive: 3000 });
}
const target = { host: 'localhost', port: '4748' };
const send = (owner: WebClient, onError: ReturnType<typeof vi.fn>) =>
  owner.protobuf.sendSessionCommand(Command_Ping_ext, create(Command_PingSchema), { onError });

beforeEach(() => {
  vi.useFakeTimers();
  harness = installMockWebSocketHarness();
});
afterEach(() => {
  WebClient.dispose();
  harness.restore();
  vi.useRealTimers();
});

it('settles before singleton replacement and blocks callback sends during asynchronous close', () => {
  const old = client();
  old.connect(target);
  harness.mockInstance.onopen!();
  const reentrant = vi.fn();
  const failure = vi.fn(() => {
    expect(WebClient.instance).toBe(old);
    send(old, reentrant);
  });
  send(old, failure);
  WebClient.dispose();
  expect(failure).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.anything(), CommandFailure.Disconnected);
  expect(reentrant).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.anything(), CommandFailure.NotSent);
  expect(harness.mockInstance.send).toHaveBeenCalledTimes(1);
  expect(harness.mockInstance.onclose).toBeNull();
  expect(harness.mockInstance.onerror).toBeNull();
  expect(harness.mockInstance.onmessage).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  const replacement = client();
  vi.advanceTimersByTime(60_000);
  expect(WebClient.instance).toBe(replacement);
  expect(replacement.response.session.updateStatus).not.toHaveBeenCalled();
  expect(failure).toHaveBeenCalledTimes(1);
});

it('makes the old transport unavailable before reconnect settlement callbacks', () => {
  const owner = client();
  owner.connect(target);
  harness.mockInstance.onopen!();
  const reentrant = vi.fn();
  send(owner, vi.fn(() => send(owner, reentrant)));
  owner.connect(target);
  expect(reentrant).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.anything(), CommandFailure.NotSent);
  expect(harness.mockInstance.send).toHaveBeenCalledTimes(1);
  expect(harness.mockInstance.onclose).toBeNull();
  harness.instances[1].onopen!();
  const current = vi.fn();
  send(owner, current);
  WebClient.dispose();
  expect(current).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.anything(), CommandFailure.Disconnected);
  expect(reentrant).toHaveBeenCalledTimes(1);
});

it('retires a connecting probe without late callbacks or its timeout', () => {
  const owner = client();
  owner.testConnect(target);
  harness.mockInstance.readyState = WebSocket.CONNECTING;
  WebClient.dispose();
  expect(vi.getTimerCount()).toBe(0);
  expect(harness.mockInstance.onmessage).toBeNull();
  expect(harness.mockInstance.onclose).toBeNull();
  harness.mockInstance.readyState = WebSocket.OPEN;
  harness.mockInstance.onopen!();
  expect(harness.mockInstance.close).toHaveBeenCalledTimes(1);
});
