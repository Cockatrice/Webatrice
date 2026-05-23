// Shared mock factories for websocket layer unit tests. Distinct from the
// integration-layer `setup.ts` harness — these are lower-level builders that
// unit tests opt into one-off without taking on the full WebClient singleton
// reset/timer-installation that `setup.ts` performs.

import { vi } from 'vitest';

/** Builds a mock WebSocket instance */
export function makeMockWebSocketInstance() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: WebSocket.OPEN as number,
    binaryType: '' as BinaryType,
    onopen: null as ((ev?: Event) => void) | null,
    onclose: null as ((ev?: CloseEvent) => void) | null,
    onerror: null as ((ev?: Event) => void) | null,
    onmessage: null as ((ev: MessageEvent) => void) | null,
  };
}

/**
 * Installs a mock WebSocket constructor on global and returns the harness
 * (constructor reference, initial mock instance, instance list, and a
 * restore function). Unit-test counterpart to the void-return integration
 * helper exported from `./setup`; tests that want full lifecycle management
 * call this directly and invoke `restore()` themselves.
 */
export function installMockWebSocketHarness() {
  const originalWebSocket = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  const mockInstance = makeMockWebSocketInstance();
  const instances: ReturnType<typeof makeMockWebSocketInstance>[] = [mockInstance];
  let firstCall = true;
  const MockWS = vi.fn(function MockWebSocket() {
    if (firstCall) {
      firstCall = false;
      return mockInstance;
    }
    const next = makeMockWebSocketInstance();
    instances.push(next);
    return next;
  }) as unknown as typeof WebSocket;
  (MockWS as unknown as { OPEN: number }).OPEN = 1;
  (MockWS as unknown as { CLOSED: number }).CLOSED = 3;
  (globalThis as { WebSocket: typeof WebSocket }).WebSocket = MockWS;
  return {
    MockWS,
    mockInstance,
    instances,
    restore: () => {
      (globalThis as { WebSocket?: typeof WebSocket }).WebSocket = originalWebSocket;
    },
  };
}
