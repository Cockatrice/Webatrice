export interface PendingPointer {
  x: number;
  y: number;
}

export interface PendingPointerStore {
  get(): PendingPointer | null;
  set(pointer: PendingPointer | null): void;
  subscribe(listener: () => void): () => void;
}

export function createPendingPointerStore(): PendingPointerStore {
  let current: PendingPointer | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (pointer) => {
      if (pointer === current) {
        return;
      }
      current = pointer;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
