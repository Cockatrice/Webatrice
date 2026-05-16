import { renderHook } from '@testing-library/react';

vi.mock('@app/hooks', async (orig) => {
  const actual = await orig<typeof import('@app/hooks')>();
  return { ...actual, useSettings: vi.fn() };
});

import { useSettings, LoadingState } from '@app/hooks';
import { shortcuts } from '@app/store';

import { makeSettings, makeSettingsHook } from '../../hooks/__mocks__/useSettings';
import { makeReduxHookWrapper } from '../../__test-utils__/makeHookWrapper';
import { useShortcutsHydration } from './useShortcutsHydration';

const reducer = { shortcuts: shortcuts.shortcutsReducer };

function setupStore(hydrated: boolean) {
  return makeReduxHookWrapper(reducer as any, {
    shortcuts: {
      overrides: {},
      hydrated,
      recordingActionId: null,
      recordingSequences: [],
    },
  } as any);
}

describe('useShortcutsHydration', () => {
  it('dispatches hydrate with persisted shortcut overrides when ready', () => {
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({
        value: makeSettings({ shortcuts: { 'game.drawCard': ['Ctrl+KeyZ'] } as any }),
      }),
    );
    const { Wrapper, store } = setupStore(false);

    renderHook(() => useShortcutsHydration(), { wrapper: Wrapper });

    const state = store.getState() as ReturnType<typeof store.getState>;
    expect(state.shortcuts.hydrated).toBe(true);
    expect(state.shortcuts.overrides).toEqual({ 'game.drawCard': ['Ctrl+KeyZ'] });
  });

  it('hydrates with an empty object when no persisted overrides exist', () => {
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({ value: makeSettings() }),
    );
    const { Wrapper, store } = setupStore(false);

    renderHook(() => useShortcutsHydration(), { wrapper: Wrapper });

    const state = store.getState() as ReturnType<typeof store.getState>;
    expect(state.shortcuts.hydrated).toBe(true);
    expect(state.shortcuts.overrides).toEqual({});
  });

  it('skips hydration when settings are still loading', () => {
    vi.mocked(useSettings).mockReturnValue({
      status: LoadingState.LOADING,
      update: vi.fn(),
    } as any);
    const { Wrapper, store } = setupStore(false);

    renderHook(() => useShortcutsHydration(), { wrapper: Wrapper });

    expect((store.getState() as any).shortcuts.hydrated).toBe(false);
  });

  it('skips hydration when already hydrated', () => {
    const dispatchedOverrides = { 'game.drawCard': ['Ctrl+KeyZ'] };
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({ value: makeSettings({ shortcuts: dispatchedOverrides as any }) }),
    );
    const { Wrapper, store } = setupStore(true);

    renderHook(() => useShortcutsHydration(), { wrapper: Wrapper });

    expect((store.getState() as any).shortcuts.overrides).toEqual({});
  });
});
