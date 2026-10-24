import { renderHook } from '@testing-library/react';

import { shortcuts } from '@app/store';

import { makeReduxHookWrapper } from '../../__test-utils__/makeHookWrapper';
import { toMenuShortcut, useMenuShortcut } from './menuShortcut';

const reducer = { shortcuts: shortcuts.shortcutsReducer };

function setup(overrides: Record<string, string[]> = {}) {
  const { Wrapper } = makeReduxHookWrapper(reducer as any, {
    shortcuts: {
      overrides,
      hydrated: true,
      recordingActionId: null,
      recordingSequences: [],
    },
  } as any);
  return Wrapper;
}

describe('toMenuShortcut', () => {
  it('shows the first binding and names every binding for assistive technology', () => {
    expect(toMenuShortcut(['Ctrl+Enter', 'Ctrl+NumpadEnter'], false))
      .toEqual({ shortcut: 'Ctrl+Enter', keyShortcuts: 'Control+Enter Control+Enter' });
    expect(toMenuShortcut(['Ctrl+Shift+KeyA', 'Alt+Digit3', 'Meta+F2'], false))
      .toEqual({ shortcut: 'Ctrl+Shift+A', keyShortcuts: 'Control+Shift+A Alt+3 Meta+F2' });
  });

  it('names punctuation and numpad keys by the character they type', () => {
    expect(toMenuShortcut(['Ctrl+Equal', 'NumpadAdd', 'Numpad7', 'Shift+Space'], false).keyShortcuts)
      .toBe('Control+= Plus 7 Shift+Space');
  });

  it('exposes both accepted Control and Meta alternatives on Mac', () => {
    expect(toMenuShortcut(['Ctrl+Shift+KeyD'], true)).toEqual({ shortcut: '⌘⇧D', keyShortcuts: 'Control+Shift+D Shift+Meta+D' });
  });

  it('is empty for an unbound action', () => {
    expect(toMenuShortcut([], false)).toEqual({ shortcut: '', keyShortcuts: '' });
  });
});

describe('useMenuShortcut', () => {
  it('follows the default binding', () => {
    const { result } = renderHook(() => useMenuShortcut(), { wrapper: setup() });
    expect(result.current('game.drawCard')).toEqual({ shortcut: 'Ctrl+D', keyShortcuts: 'Control+D' });
  });

  it('follows the user\'s rebinding', () => {
    const { result } = renderHook(() => useMenuShortcut(), { wrapper: setup({ 'game.drawCard': ['Alt+KeyZ'] }) });
    expect(result.current('game.drawCard')).toEqual({ shortcut: 'Alt+Z', keyShortcuts: 'Alt+Z' });
  });
});
