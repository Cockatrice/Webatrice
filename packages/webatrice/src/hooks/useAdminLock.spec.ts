import { act, renderHook } from '@testing-library/react';

import { setAdminLocked, useAdminLock, useAdminLocked } from './useAdminLock';

afterEach(() => {
  setAdminLocked(false);
});

describe('useAdminLock', () => {
  it('starts unlocked, as desktop does when the admin tab opens at login', () => {
    const { result } = renderHook(() => useAdminLocked());
    expect(result.current).toBe(false);
  });

  it('shares one lock between the Administration page and every reader', () => {
    const page = renderHook(() => useAdminLock());
    const menu = renderHook(() => useAdminLocked());

    act(() => page.result.current[1](true));
    expect(page.result.current[0]).toBe(true);
    expect(menu.result.current).toBe(true);

    act(() => page.result.current[1](false));
    expect(menu.result.current).toBe(false);
  });
});
