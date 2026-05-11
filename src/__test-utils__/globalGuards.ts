// @critical `Object.defineProperty(window, 'location', ...)` is not a vi.spyOn target — restoreAllMocks won't undo it.
// Always invoke the returned restore fn.
export function withMockLocation(overrides: Partial<Location>): () => void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');

  Object.defineProperty(window, 'location', {
    value: { ...window.location, ...overrides },
    writable: true,
    configurable: true,
  });

  return () => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'location', originalDescriptor);
    }
  };
}
