/*
 * Worker handler factory — pure function, no side effects.
 *
 * Split out of `keepAliveWorker.ts` so that the worker entry file contains
 * ONLY the bootstrap (`self.onmessage = ...`) at the top level. With
 * Sockatrice's `package.json` `"sideEffects": false`, any worker-entry file
 * that defines a function AND immediately calls it gets tsup-split, and
 * Vite then tree-shakes the resulting chunk — producing a 0-byte worker
 * file in consumer builds (the keepalive silently never pings). Keeping
 * the bootstrap as the sole top-level statement of `keepAliveWorker.ts`
 * makes the side effect part of the worker entry itself, which Vite's
 * worker bundler always preserves.
 *
 * See `keepAliveWorker.ts` for the bootstrap; tests / harnesses that want
 * the pure handler should import from THIS file.
 */

export type WorkerMessage =
  | { type: 'start'; interval: number }
  | { type: 'stop' };

export type TickMessage = { type: 'tick' };

export function createWorkerHandler(
  post: (msg: TickMessage) => void,
): (event: MessageEvent<WorkerMessage>) => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  return (event) => {
    const data = event.data;
    if (!data) {
      return;
    }
    if (data.type === 'start') {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      intervalId = setInterval(() => post({ type: 'tick' }), data.interval);
    } else if (data.type === 'stop') {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  };
}
