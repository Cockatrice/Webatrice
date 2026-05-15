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
