import { act, renderHook } from '@testing-library/react';

vi.mock('@app/hooks', async (orig) => {
  const actual = await orig<typeof import('@app/hooks')>();
  return { ...actual, useSettings: vi.fn() };
});

import { useSettings, LoadingState } from '@app/hooks';
import { shortcuts } from '@app/store';

import { makeSettings, makeSettingsHook } from '../../hooks/__mocks__/useSettings';
import { makeReduxHookWrapper } from '../../__test-utils__/makeHookWrapper';
import { useShortcutsPersistence } from './useShortcutsPersistence';

const reducer = { shortcuts: shortcuts.shortcutsReducer };

function setupStore(hydrated: boolean, overrides: Record<string, string[]> = {}) {
  return makeReduxHookWrapper(reducer as any, {
    shortcuts: {
      overrides,
      hydrated,
      recordingActionId: null,
      recordingSequences: [],
    },
  } as any);
}

describe('useShortcutsPersistence', () => {
  it('does not persist the initial snapshot on the first render', () => {
    const update = vi.fn();
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({ value: makeSettings(), update }),
    );
    const { Wrapper } = setupStore(true, { 'game.drawCard': ['Ctrl+KeyZ'] });

    renderHook(() => useShortcutsPersistence(), { wrapper: Wrapper });

    expect(update).not.toHaveBeenCalled();
  });

  it('persists overrides through useSettings.update when they change after mount', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({ value: makeSettings(), update }),
    );
    const { Wrapper, store } = setupStore(true);

    renderHook(() => useShortcutsPersistence(), { wrapper: Wrapper });

    act(() => {
      store.dispatch(
        shortcuts.Actions.setOverride({
          actionId: 'game.drawCard',
          sequences: ['Ctrl+KeyZ'],
        }),
      );
    });

    expect(update).toHaveBeenCalledWith({
      shortcuts: { 'game.drawCard': ['Ctrl+KeyZ'] },
    });
  });

  it('skips persistence while shortcuts are not yet hydrated', () => {
    const update = vi.fn();
    vi.mocked(useSettings).mockReturnValue(
      makeSettingsHook({ value: makeSettings(), update }),
    );
    const { Wrapper, store } = setupStore(false);

    renderHook(() => useShortcutsPersistence(), { wrapper: Wrapper });

    act(() => {
      store.dispatch(
        shortcuts.Actions.setOverride({
          actionId: 'game.drawCard',
          sequences: ['Ctrl+KeyZ'],
        }),
      );
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('skips persistence while settings are still loading', () => {
    const update = vi.fn();
    vi.mocked(useSettings).mockReturnValue({
      status: LoadingState.LOADING,
      update,
    } as any);
    const { Wrapper, store } = setupStore(true);

    renderHook(() => useShortcutsPersistence(), { wrapper: Wrapper });

    act(() => {
      store.dispatch(
        shortcuts.Actions.setOverride({
          actionId: 'game.drawCard',
          sequences: ['Ctrl+KeyZ'],
        }),
      );
    });

    expect(update).not.toHaveBeenCalled();
  });
});
