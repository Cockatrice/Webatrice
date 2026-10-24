import { act, renderHook } from '@testing-library/react';

const STORAGE_KEY = 'webatrice.snapGridVisible';

async function loadModule() {
  vi.resetModules();
  return import('./useSnapGridVisible');
}

describe('useSnapGridVisible', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('is off when nothing is persisted', async () => {
    const { useSnapGridVisible } = await loadModule();

    const { result } = renderHook(() => useSnapGridVisible());

    expect(result.current).toBe(false);
  });

  it('restores a persisted value', async () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    const { useSnapGridVisible } = await loadModule();

    const { result } = renderHook(() => useSnapGridVisible());

    expect(result.current).toBe(true);
  });

  it('pushes a toggle to every subscriber and persists it', async () => {
    const { useSnapGridSetting, useSnapGridVisible } = await loadModule();
    const setting = renderHook(() => useSnapGridSetting());
    const reader = renderHook(() => useSnapGridVisible());

    act(() => setting.result.current[1](true));

    expect(setting.result.current[0]).toBe(true);
    expect(reader.result.current).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');
  });
});
