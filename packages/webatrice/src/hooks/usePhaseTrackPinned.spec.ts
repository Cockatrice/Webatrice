import { act, renderHook } from '@testing-library/react';

const STORAGE_KEY = 'webatrice.phaseTrackPinned';

async function loadModule() {
  vi.resetModules();
  return import('./usePhaseTrackPinned');
}

describe('usePhaseTrackPinned', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('is pinned when nothing is persisted', async () => {
    const { usePhaseTrackPinned } = await loadModule();

    const { result } = renderHook(() => usePhaseTrackPinned());

    expect(result.current).toBe(true);
  });

  it('restores a persisted auto-hide preference', async () => {
    window.localStorage.setItem(STORAGE_KEY, '0');
    const { usePhaseTrackPinned } = await loadModule();

    const { result } = renderHook(() => usePhaseTrackPinned());

    expect(result.current).toBe(false);
  });

  it('pushes a toggle to every subscriber and persists it', async () => {
    const { usePhaseTrackPinnedSetting, usePhaseTrackPinned } = await loadModule();
    const setting = renderHook(() => usePhaseTrackPinnedSetting());
    const reader = renderHook(() => usePhaseTrackPinned());

    act(() => setting.result.current[1](false));

    expect(setting.result.current[0]).toBe(false);
    expect(reader.result.current).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('0');
  });
});
