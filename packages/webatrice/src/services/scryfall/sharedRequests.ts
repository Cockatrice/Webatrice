import { abortError } from './scheduler';

interface RequestEntry<T> {
  controller: AbortController;
  promise: Promise<T>;
  subscribers: number;
  completed: boolean;
}

export function createSharedRequestPool<T>() {
  const pending = new Map<string, RequestEntry<T>>();

  return (key: string, start: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted) {
      return Promise.reject(abortError());
    }
    let entry = pending.get(key);
    if (!entry) {
      const controller = new AbortController();
      entry = { controller, promise: start(controller.signal), subscribers: 0, completed: false };
      pending.set(key, entry);
      const current = entry;
      const remove = () => {
        current.completed = true;
        if (pending.get(key) === current) {
          pending.delete(key);
        }
      };
      void entry.promise.then(remove, remove);
    }
    const current = entry;
    current.subscribers++;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const detach = () => {
        settled = true;
        signal?.removeEventListener('abort', abort);
        current.subscribers--;
        if (current.subscribers === 0) {
          if (pending.get(key) === current) {
            pending.delete(key);
          }
          if (!current.completed) {
            current.controller.abort();
          }
        }
      };
      const abort = () => {
        if (!settled) {
          detach();
          reject(abortError());
        }
      };
      signal?.addEventListener('abort', abort, { once: true });
      void current.promise.then((value) => {
        if (!settled) {
          detach();
          resolve(value);
        }
      }, (error: unknown) => {
        if (!settled) {
          detach();
          reject(error);
        }
      });
    });
  };
}
