// Pure handler factory; bootstrap stays in keepAliveWorker.ts.
// See .github/instructions/sockatrice-transport.instructions.md#keep-alive-worker.

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
