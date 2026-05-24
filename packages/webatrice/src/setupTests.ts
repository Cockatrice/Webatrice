// @critical Must match the production boot order in src/index.tsx. See .github/instructions/webatrice.instructions.md#initialization-order.
import './polyfills';

import '@testing-library/jest-dom/vitest';

// jsdom doesn't provide ResizeObserver; react-window needs it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
}

// jsdom doesn't implement Element.scrollIntoView; ScrollToBottomOnChanges uses it.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Dexie eagerly opens IndexedDB on import; jsdom's fake-indexeddb is memory-intensive.
vi.mock('dexie', () => {
  const fakeTable = {
    mapToClass: () => {},
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    add: () => Promise.resolve(1),
    bulkAdd: () => Promise.resolve(),
    delete: () => Promise.resolve(),
    toArray: () => Promise.resolve([]),
    where: () => ({ equals: () => ({ first: () => Promise.resolve(null) }) }),
  };
  class FakeDexie {
    version() {
      const chain = { stores: () => chain, upgrade: () => chain };
      return chain;
    }
    open() {
      return Promise.resolve(this);
    }
    table() {
      return fakeTable;
    }
  }
  return { default: FakeDexie, __esModule: true };
});

// See .github/instructions/webatrice-testing.instructions.md#mocking-footguns.
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
