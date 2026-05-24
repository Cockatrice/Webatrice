import { afterEach, beforeEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';

export interface ConsoleErrorRef {
  current: MockInstance | null;
}

// Installs a `console.error` spy for every test in the enclosing describe block.
// Returns a ref whose `current` is the live spy during each test (useful for
// expect(...).toHaveBeenCalledWith assertions). The spy swallows output and is
// restored after each test, so unrelated tests are unaffected.
export function expectConsoleErrors(): ConsoleErrorRef {
  const ref: ConsoleErrorRef = { current: null };
  beforeEach(() => {
    ref.current = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    ref.current?.mockRestore();
    ref.current = null;
  });
  return ref;
}
