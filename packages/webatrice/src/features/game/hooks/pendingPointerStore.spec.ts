import { createPendingPointerStore } from './pendingPointerStore';

describe('createPendingPointerStore', () => {
  it('notifies subscribers of each new pointer until they unsubscribe', () => {
    const store = createPendingPointerStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ x: 1, y: 2 });
    expect(store.get()).toEqual({ x: 1, y: 2 });
    store.set(null);
    store.set(null);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.set({ x: 3, y: 4 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
