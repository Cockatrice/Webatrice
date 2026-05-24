import { renderHook } from '@testing-library/react';

import { shortcuts } from '@app/store';

import { makeReduxHookWrapper } from '../../__test-utils__/makeHookWrapper';
import { useResolvedBinding } from './useResolvedBinding';

const reducer = { shortcuts: shortcuts.shortcutsReducer };

function setup(overrides: Record<string, string[]> = {}, hydrated = true) {
  const { Wrapper } = makeReduxHookWrapper(reducer as any, {
    shortcuts: {
      overrides,
      hydrated,
      recordingActionId: null,
      recordingSequences: [],
    },
  } as any);
  return Wrapper;
}

describe('useResolvedBinding', () => {
  it('returns the override when one is present', () => {
    const wrapper = setup({ 'game.drawCard': ['Ctrl+KeyZ'] });
    const { result } = renderHook(() => useResolvedBinding('game.drawCard'), { wrapper });
    expect(result.current).toEqual(['Ctrl+KeyZ']);
  });

  it('falls back to the catalog default when no override is set', () => {
    const wrapper = setup({});
    const { result } = renderHook(() => useResolvedBinding('game.drawCard'), { wrapper });
    expect(result.current).toEqual(['Ctrl+KeyD']);
  });

  it('returns an empty array for an unknown actionId', () => {
    const wrapper = setup({});
    const { result } = renderHook(
      () => useResolvedBinding('does.not.exist' as never),
      { wrapper },
    );
    expect(result.current).toEqual([]);
  });
});
