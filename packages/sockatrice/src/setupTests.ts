// See .github/instructions/sockatrice.instructions.md#public-testing-surface.
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
