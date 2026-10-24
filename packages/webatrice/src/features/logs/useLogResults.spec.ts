import { act, renderHook } from '@testing-library/react';

import { useLogResults } from './useLogResults';

describe('useLogResults', () => {
  it('starts on the first tab', () => {
    const { result } = renderHook(() => useLogResults());
    expect(result.current.value).toBe(0);
  });

  it('handleChange updates the active tab value', () => {
    const { result } = renderHook(() => useLogResults());
    act(() => {
      result.current.handleChange(null, 2);
    });
    expect(result.current.value).toBe(2);
  });
});

describe('useLogResults selection', () => {
  it('selects a row and forgets it when the tab changes', () => {
    const { result } = renderHook(() => useLogResults());
    act(() => {
      result.current.select('row-1');
    });
    expect(result.current.selectedKey).toBe('row-1');
    act(() => {
      result.current.handleChange(null, 1);
    });
    expect(result.current.selectedKey).toBeNull();
  });
});
