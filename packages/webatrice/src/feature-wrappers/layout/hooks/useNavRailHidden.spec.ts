import { act, renderHook } from '@testing-library/react';

const STORAGE_KEY = 'webatrice.navRailHidden';

async function loadModule() {
  vi.resetModules();
  return import('./useNavRailHidden');
}

describe('useNavRailHidden', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows the rail by default', async () => {
    const { useNavRailHidden } = await loadModule();

    const { result } = renderHook(() => useNavRailHidden());

    expect(result.current[0]).toBe(false);
  });

  it('remembers hiding the rail across reloads', async () => {
    const { useNavRailHidden } = await loadModule();
    const first = renderHook(() => useNavRailHidden());
    act(() => first.result.current[1](true));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');

    const { useNavRailHidden: reloaded } = await loadModule();
    const { result } = renderHook(() => reloaded());

    expect(result.current[0]).toBe(true);
  });

  it('shares the state between every caller', async () => {
    const { useNavRailHidden } = await loadModule();
    const a = renderHook(() => useNavRailHidden());
    const b = renderHook(() => useNavRailHidden());

    act(() => a.result.current[1](true));

    expect(b.result.current[0]).toBe(true);
  });

  it('still toggles when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { useNavRailHidden } = await loadModule();
    const { result } = renderHook(() => useNavRailHidden());

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
  });
});
