// Inject the `ws` package's WebSocket as the global constructor BEFORE any
// Sockatrice code runs. jsdom ships its own WebSocket implementation, but it's
// unreliable for real outbound binary connections; `ws` is what every
// integration with servatrice in node uses.

import { WebSocket as NodeWebSocket } from 'ws';
import { afterEach, beforeEach } from 'vitest';

import { createE2EClient, resetE2EClient } from '../helpers/e2e-client';

(globalThis as unknown as { WebSocket: typeof globalThis.WebSocket }).WebSocket =
  NodeWebSocket as unknown as typeof globalThis.WebSocket;

beforeEach(() => {
  createE2EClient();
});

afterEach(() => {
  resetE2EClient();
});
