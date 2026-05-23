// Bootstrap-only worker entry. See .github/instructions/sockatrice-transport.instructions.md#keep-alive-worker.

import { createWorkerHandler } from './keepAliveWorkerHandler';

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (msg: unknown) => void;
};
ctx.onmessage = createWorkerHandler((msg) => ctx.postMessage(msg));
