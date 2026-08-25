import { installMockWebSocketHarness } from '../testing/mock-websocket';
import { withMockLocation } from '../__test-utils__';
import { Mock } from 'vitest';

import { WebSocketService } from './WebSocketService';
import type { WebSocketServiceConfig, ReconnectConfig } from './WebSocketService';
import { KeepAliveService } from './KeepAliveService';
import { StatusEnum } from '../types/StatusEnum';

type WebSocketInternal = WebSocketService & {
  keepAliveService: KeepAliveService;
};

let MockWS: Mock;
let mockInstance: ReturnType<typeof installMockWebSocketHarness>['mockInstance'];
let restoreWebSocket: ReturnType<typeof installMockWebSocketHarness>['restore'];
let mockConfig: WebSocketServiceConfig;
let mockOnConnectionFailed: Mock;
let mockOnConnectionUnreachable: Mock;
let mockOnStatusChange: Mock;
let mockOnMessage: Mock;
let locationRestores: Array<() => void>;

beforeEach(() => {
  vi.useFakeTimers();

  const installed = installMockWebSocketHarness();
  MockWS = installed.MockWS;
  mockInstance = installed.mockInstance;
  restoreWebSocket = installed.restore;

  mockOnConnectionFailed = vi.fn();
  mockOnConnectionUnreachable = vi.fn();
  mockOnStatusChange = vi.fn();
  mockOnMessage = vi.fn();

  mockConfig = {
    keepAliveFn: vi.fn(),
    keepalive: 1000,
    onConnectionFailed: mockOnConnectionFailed,
    onConnectionUnreachable: mockOnConnectionUnreachable,
    onStatusChange: mockOnStatusChange,
    onMessage: mockOnMessage,
  };

  locationRestores = [];
});

afterEach(() => {
  while (locationRestores.length > 0) {
    locationRestores.pop()!();
  }
  restoreWebSocket();
  vi.useRealTimers();
});

describe('WebSocketService', () => {
  function createConnectedService() {
    const service = new WebSocketService(mockConfig);
    service.connect({ host: 'h', port: '1' });
    return service;
  }

  describe('constructor', () => {
    it('constructs without throwing', () => {
      const service = new WebSocketService(mockConfig);
      expect(service).toBeDefined();
    });

    it('never closes the socket on missed pongs; reports degraded health instead', () => {
      const onConnectionHealth = vi.fn();
      const service = new WebSocketService({ ...mockConfig, onConnectionHealth });
      service.connect({ host: 'localhost', port: '8080' });
      mockInstance.onopen();
      // The mock keepAliveFn never resolves the pong callback: sustained
      // silence, yet the keepalive never tears the connection down (see
      // KeepAliveService).
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(10_000);
      expect(mockInstance.close).not.toHaveBeenCalled();
      expect(mockOnStatusChange).not.toHaveBeenCalledWith(StatusEnum.DISCONNECTED, expect.anything());
      expect(onConnectionHealth).toHaveBeenLastCalledWith(10, expect.any(Number));
    });
  });

  describe('connect', () => {
    it('creates a wss:// WebSocket for a remote target', () => {
      const service = new WebSocketService(mockConfig);
      service.connect({ host: 'example.com', port: '8080' });
      expect(MockWS).toHaveBeenCalledWith('wss://example.com:8080');
    });

    it('uses wss:// for a remote target even when the page is served from localhost', () => {
      // Regression: the old code downgraded to ws:// based on the page origin,
      // which broke local dev against TLS-only servers (e.g. Rooster).
      const service = new WebSocketService(mockConfig);
      locationRestores.push(withMockLocation({ hostname: 'localhost' }));
      service.connect({ host: 'example.com', port: '8080' });
      expect(MockWS).toHaveBeenCalledWith('wss://example.com:8080');
    });

    it('uses ws:// only when the target host itself is local', () => {
      const service = new WebSocketService(mockConfig);
      service.connect({ host: 'localhost', port: '1234' });
      expect(MockWS).toHaveBeenCalledWith('ws://localhost:1234');
    });

    it('sets binaryType to arraybuffer', () => {
      createConnectedService();
      expect(mockInstance.binaryType).toBe('arraybuffer');
    });

    it('fires socket.close after keepalive timeout', () => {
      createConnectedService();
      vi.advanceTimersByTime(1000);
      expect(mockInstance.close).toHaveBeenCalled();
    });
  });

  describe('socket event handlers (onopen)', () => {
    it('clears the connection timeout when socket opens', () => {
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      createConnectedService();
      mockInstance.onopen();
      expect(clearSpy).toHaveBeenCalled();
    });

    it('calls onStatusChange CONNECTED on open', () => {
      createConnectedService();
      mockInstance.onopen();
      expect(mockOnStatusChange).toHaveBeenCalledWith(StatusEnum.CONNECTED, 'Connected');
    });

    it('starts the ping loop with the keepalive interval', () => {
      const service = new WebSocketService(mockConfig);
      const startSpy = vi.spyOn((service as WebSocketInternal).keepAliveService, 'startPingLoop');
      service.connect({ host: 'h', port: '1' });
      mockInstance.onopen();
      expect(startSpy).toHaveBeenCalledWith(1000, expect.any(Function));
    });

    it('ping loop callback calls keepAliveFn', () => {
      const service = new WebSocketService(mockConfig);
      const startSpy = vi.spyOn((service as WebSocketInternal).keepAliveService, 'startPingLoop');
      service.connect({ host: 'h', port: '1' });
      mockInstance.onopen();
      const pingCb = startSpy.mock.calls[0][1] as (done: Function) => void;
      const done = vi.fn();
      pingCb(done);
      expect(mockConfig.keepAliveFn).toHaveBeenCalledWith(done);
    });
  });

  describe('socket event handlers (onclose)', () => {
    it('calls onStatusChange DISCONNECTED on close when not already DISCONNECTED', () => {
      createConnectedService();
      mockInstance.onclose();
      expect(mockOnStatusChange).toHaveBeenCalledWith(StatusEnum.DISCONNECTED, 'Connection Closed');
    });

    it('does not overwrite status if already DISCONNECTED', () => {
      createConnectedService();
      mockInstance.onerror();
      mockInstance.onclose();
      expect(mockOnStatusChange).not.toHaveBeenCalledWith(StatusEnum.DISCONNECTED, 'Connection Closed');
    });

    it('ends the ping loop on close', () => {
      const service = new WebSocketService(mockConfig);
      const endSpy = vi.spyOn((service as WebSocketInternal).keepAliveService, 'endPingLoop');
      service.connect({ host: 'h', port: '1' });
      mockInstance.onclose();
      expect(endSpy).toHaveBeenCalled();
    });
  });

  describe('socket event handlers (onerror)', () => {
    it('calls onStatusChange DISCONNECTED on error', () => {
      createConnectedService();
      mockInstance.onerror();
      expect(mockOnStatusChange).toHaveBeenCalledWith(StatusEnum.DISCONNECTED, 'Connection Failed');
    });

    it('calls onConnectionFailed on error', () => {
      createConnectedService();
      mockInstance.onerror();
      expect(mockOnConnectionFailed).toHaveBeenCalled();
    });
  });

  describe('connect unreachable (onConnectionUnreachable)', () => {
    it('fires when a never-opened socket closes (fast fail: onclose before open)', () => {
      createConnectedService();
      mockInstance.onclose();
      expect(mockOnConnectionUnreachable).toHaveBeenCalledTimes(1);
    });

    it('fires on the slow-hang path (connect-timer closes the stuck socket → onclose)', () => {
      createConnectedService();
      // The timer closes the still-CONNECTING socket; in a real socket that
      // close drives onclose. Advance the timer, then drive onclose as the
      // browser would.
      vi.advanceTimersByTime(1000);
      expect(mockInstance.close).toHaveBeenCalled();
      mockInstance.onclose();
      expect(mockOnConnectionUnreachable).toHaveBeenCalledTimes(1);
    });

    it('fires after a fast onerror → onclose sequence', () => {
      createConnectedService();
      mockInstance.onerror();
      mockInstance.onclose();
      expect(mockOnConnectionUnreachable).toHaveBeenCalledTimes(1);
    });

    it('does not fire when the socket opened before closing (post-open drop)', () => {
      createConnectedService();
      mockInstance.onopen();
      mockInstance.onclose();
      expect(mockOnConnectionUnreachable).not.toHaveBeenCalled();
    });

    it('does not fire on an intentional disconnect before open', () => {
      const service = createConnectedService();
      service.disconnect();
      mockInstance.onclose();
      expect(mockOnConnectionUnreachable).not.toHaveBeenCalled();
    });

    it('does not fire for a retired socket whose onclose arrives after a new connect', () => {
      const service = new WebSocketService(mockConfig);
      service.connect({ host: 'h', port: '1' });
      const firstSocket = mockInstance;
      // A second connect retires the prior socket and detaches its onclose, so a
      // late onclose is a no-op (`?.`) and can't misfire onConnectionUnreachable.
      service.connect({ host: 'h', port: '2' });
      firstSocket.onclose?.();
      expect(mockOnConnectionUnreachable).not.toHaveBeenCalled();
    });

    it('is optional — a config without onConnectionUnreachable still closes cleanly', () => {
      const service = new WebSocketService({ ...mockConfig, onConnectionUnreachable: undefined });
      service.connect({ host: 'h', port: '1' });
      expect(() => mockInstance.onclose()).not.toThrow();
    });
  });

  describe('socket event handlers (onmessage)', () => {
    it('invokes the onMessage callback with the event', () => {
      createConnectedService();
      const event = { data: new ArrayBuffer(4) } as MessageEvent;
      mockInstance.onmessage(event);
      expect(mockOnMessage).toHaveBeenCalledWith(event);
    });
  });

  describe('disconnect', () => {
    it('closes the socket', () => {
      const service = createConnectedService();
      service.disconnect();
      expect(mockInstance.close).toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('delegates to socket.send', () => {
      const service = createConnectedService();
      const data = new Uint8Array([1, 2, 3]);
      service.send(data);
      expect(mockInstance.send).toHaveBeenCalledWith(data);
    });

    it('does not throw when socket is undefined (before connect)', () => {
      const service = new WebSocketService(mockConfig);
      const data = new Uint8Array([1, 2, 3]);
      expect(() => service.send(data)).not.toThrow();
    });

    it('skips send when readyState is not OPEN', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const service = createConnectedService();
      // CONNECTING
      mockInstance.readyState = 0;
      const data = new Uint8Array([1, 2, 3]);
      service.send(data);
      expect(mockInstance.send).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '[WebSocketService] send() skipped: socket not OPEN',
        0,
      );
      warnSpy.mockRestore();
    });
  });

  describe('checkReadyState', () => {
    it('returns true when readyState matches', () => {
      const service = createConnectedService();
      mockInstance.readyState = WebSocket.OPEN;
      expect(service.checkReadyState(WebSocket.OPEN)).toBe(true);
    });

    it('returns false when readyState does not match', () => {
      const service = createConnectedService();
      // CLOSED
      mockInstance.readyState = 3;
      expect(service.checkReadyState(WebSocket.OPEN)).toBe(false);
    });

    it('returns false when socket is null', () => {
      const service = new WebSocketService(mockConfig);
      // no connect called, socket is undefined
      expect(service.checkReadyState(WebSocket.OPEN)).toBe(false);
    });
  });

  describe('connect (re-entry)', () => {
    it('closes an already-open prior socket immediately when connect is called twice', () => {
      const service = new WebSocketService(mockConfig);
      service.connect({ host: 'h', port: '1' });
      const firstInstance = mockInstance;
      firstInstance.readyState = WebSocket.OPEN;
      service.connect({ host: 'h', port: '2' });
      expect(firstInstance.close).toHaveBeenCalled();
      // OPEN socket retired for reconnect: onclose/onerror detached so a late
      // close/error can't leak side effects onto the replacement (onmessage too).
      expect(firstInstance.onclose).toBeNull();
      expect(firstInstance.onerror).toBeNull();
      expect(firstInstance.onmessage).toBeNull();
    });

    it('does not abort a still-CONNECTING prior socket — defers a clean close and silences its handlers', () => {
      const service = new WebSocketService(mockConfig);
      service.connect({ host: 'h', port: '1' });
      const firstInstance = mockInstance;
      firstInstance.readyState = WebSocket.CONNECTING;

      service.connect({ host: 'h', port: '2' });

      // Not aborted synchronously — an abrupt close of a CONNECTING socket
      // strands a half-open upstream against Servatrice's per-IP cap.
      expect(firstInstance.close).not.toHaveBeenCalled();
      // Retired orphan: lifecycle handlers silenced so a late open→close can't
      // emit CONNECTED/DISCONNECTED or schedule a reconnect...
      expect(firstInstance.onclose).toBeNull();
      expect(firstInstance.onerror).toBeNull();
      // ...but a clean close is armed for when the handshake completes.
      expect(typeof firstInstance.onopen).toBe('function');
      firstInstance.onopen?.();
      expect(firstInstance.close).toHaveBeenCalled();
    });

    it('detaches a retired OPEN socket\'s onclose AND onerror so neither leaks onto the live replacement', () => {
      // An OPEN socket retired by a fresh connect() must run no lifecycle side
      // effects: a late onclose OR onerror would endPingLoop() (killing the
      // replacement's shared keepalive), corrupt hasReportedError, and emit
      // DISCONNECTED / Connection Failed against the live socket. closeActiveSocket
      // detaches both handlers, mirroring the CONNECTING branch.
      const { instances } = installMockWebSocketHarness();
      const service = new WebSocketService(mockConfig);
      const endSpy = vi.spyOn((service as WebSocketInternal).keepAliveService, 'endPingLoop');

      service.connect({ host: 'h', port: '1' });
      instances[0].onopen();
      service.connect({ host: 'h', port: '2' });
      instances[1].onopen();

      // Orphan's side-effecting handlers detached (onopen won't re-fire on an OPEN socket).
      expect(instances[0].onclose).toBeNull();
      expect(instances[0].onerror).toBeNull();

      endSpy.mockClear();
      mockOnStatusChange.mockClear();

      // Firing the orphan's (now absent) handlers is a no-op — no keepalive teardown,
      // no DISCONNECTED / Connection Failed against the replacement.
      instances[0].onclose?.();
      instances[0].onerror?.();
      expect(endSpy).not.toHaveBeenCalled();
      expect(mockOnStatusChange).not.toHaveBeenCalled();

      // The live replacement still tears down normally when IT closes.
      instances[1].onclose();
      expect(endSpy).toHaveBeenCalled();
      expect(mockOnStatusChange).toHaveBeenCalledWith(StatusEnum.DISCONNECTED, 'Connection Closed');
      void service;
    });
  });

  describe('reconnect', () => {
    const reconnect: ReconnectConfig = {
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    };

    function createReconnectService() {
      const service = new WebSocketService({ ...mockConfig, reconnect });
      service.connect({ host: 'h', port: '1' });
      mockInstance.onopen();
      return service;
    }

    it('emits RECONNECTING (not DISCONNECTED) on unexpected close when configured', () => {
      createReconnectService();
      mockOnStatusChange.mockClear();
      mockInstance.onclose();
      const statuses = mockOnStatusChange.mock.calls.map(c => c[0]);
      expect(statuses).toContain(StatusEnum.RECONNECTING);
      expect(statuses).not.toContain(StatusEnum.DISCONNECTED);
    });

    it('does not reconnect after explicit disconnect()', () => {
      const service = createReconnectService();
      mockOnStatusChange.mockClear();
      service.disconnect();
      // onclose fires with `intentionalDisconnect` already set; reconnect is
      // suppressed and the status settles on DISCONNECTED.
      mockInstance.onclose();
      const statuses = mockOnStatusChange.mock.calls.map(c => c[0]);
      expect(statuses).not.toContain(StatusEnum.RECONNECTING);
      expect(statuses).toContain(StatusEnum.DISCONNECTED);
    });

    it('gives up after maxAttempts and emits DISCONNECTED', () => {
      const { instances } = installMockWebSocketHarness();
      const service = new WebSocketService({ ...mockConfig, reconnect });
      service.connect({ host: 'h', port: '1' });
      // Flip hasEverOpened so reconnect is eligible, then drop.
      instances[0].onopen();
      mockOnStatusChange.mockClear();

      // Walk through maxAttempts failed reconnects (each socket never opens,
      // so the attempt counter keeps climbing). One final close after the
      // counter hits max emits DISCONNECTED.
      for (let i = 0; i <= reconnect.maxAttempts; i += 1) {
        instances[i].onclose();
        vi.advanceTimersByTime(reconnect.maxDelayMs);
      }

      const statuses = mockOnStatusChange.mock.calls.map(c => c[0]);
      expect(statuses).toContain(StatusEnum.DISCONNECTED);
      void service;
    });

    it('re-derives the same wss:// url when reconnecting', () => {
      createReconnectService();
      MockWS.mockClear();
      mockInstance.onclose();
      vi.advanceTimersByTime(reconnect.maxDelayMs);
      expect(MockWS).toHaveBeenCalledWith('wss://h:1');
    });

    it('resets attempt counter on successful open', () => {
      createReconnectService();
      mockOnStatusChange.mockClear();
      // simulate a drop, advance timer to trigger reconnect attempt
      mockInstance.onclose();
      vi.advanceTimersByTime(reconnect.maxDelayMs);
      // manually open the new socket (simulated)
      mockInstance.onopen();
      mockOnStatusChange.mockClear();
      // another drop — the description should start the attempt counter from 1 again
      mockInstance.onclose();
      const firstReconnect = mockOnStatusChange.mock.calls.find(c => c[0] === StatusEnum.RECONNECTING);
      expect(firstReconnect?.[1]).toMatch(/attempt 1\//);
    });

    it('orphan socket close during connect retire is suppressed (no DISCONNECTED)', () => {
      // Even if socket.close() synchronously fires onclose, the retire path has
      // already detached the handler, so the `?.` invocation is a no-op and no
      // DISCONNECTED leaks against the replacement.
      const service = new WebSocketService(mockConfig);
      service.connect({ host: 'h', port: '1' });
      mockInstance.onopen();
      const firstSocket = mockInstance;
      firstSocket.close.mockImplementation(() => firstSocket.onclose?.());
      mockOnStatusChange.mockClear();

      service.connect({ host: 'h', port: '2' });
      const statuses = mockOnStatusChange.mock.calls.map(c => c[0]);
      expect(statuses).not.toContain(StatusEnum.DISCONNECTED);
    });

    it('disconnect clears a pending reconnect timer', () => {
      const service = createReconnectService();
      mockInstance.onclose();
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      service.disconnect();
      expect(clearSpy).toHaveBeenCalled();
      // The cleared timer should not fire any reconnect.
      const wsCallsBefore = MockWS.mock.calls.length;
      vi.advanceTimersByTime(reconnect.maxDelayMs);
      expect(MockWS.mock.calls.length).toBe(wsCallsBefore);
    });

    it('reconnect timer callback aborts when intentionalDisconnect flips mid-flight', () => {
      const service = createReconnectService();
      mockInstance.onclose();
      // Force the flag without going through disconnect() (which would clear
      // the timer). This exercises the safety guard at the top of the
      // setTimeout callback.
      (service as unknown as { intentionalDisconnect: boolean }).intentionalDisconnect = true;
      const wsCallsBefore = MockWS.mock.calls.length;
      vi.advanceTimersByTime(reconnect.maxDelayMs);
      expect(MockWS.mock.calls.length).toBe(wsCallsBefore);
    });
  });

  describe('shouldAttemptReconnect — gating without reconnect config', () => {
    it('falls through to DISCONNECTED on close after open when no reconnect config is provided', () => {
      // mockConfig has no reconnect — so the !cfg guard returns false from
      // shouldAttemptReconnect AFTER hasEverOpened is true.
      createConnectedService();
      mockInstance.onopen();
      mockOnStatusChange.mockClear();
      mockInstance.onclose();
      expect(mockOnStatusChange).toHaveBeenCalledWith(StatusEnum.DISCONNECTED, 'Connection Closed');
    });
  });

});
