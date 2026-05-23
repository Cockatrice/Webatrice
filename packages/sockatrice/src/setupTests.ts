// Tests within a file share the module graph (vitest.config.ts sets isolate: true
// between files, not within them). Never add vi.resetAllMocks() — it resets
// vi.fn() instances created inside vi.mock(...) factories at file load.
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
