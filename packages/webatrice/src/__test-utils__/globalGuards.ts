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

export interface MockColorSchemeMedia {
  setPrefersDark: (dark: boolean) => void;
  restore: () => void;
}

export function withMockColorSchemeMedia(prefersDark: boolean): MockColorSchemeMedia {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let dark = prefersDark;

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      get matches() {
        return query === '(prefers-color-scheme: dark)' ? dark : false;
      },
      addEventListener: (_type: 'change', listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
      removeEventListener: (_type: 'change', listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    }),
  });

  return {
    setPrefersDark: (next) => {
      dark = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
    restore: () => {
      if (original) {
        Object.defineProperty(window, 'matchMedia', original);
      } else {
        delete (window as { matchMedia?: unknown }).matchMedia;
      }
    },
  };
}
