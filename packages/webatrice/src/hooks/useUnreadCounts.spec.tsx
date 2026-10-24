import { act, renderHook } from '@testing-library/react';

import { logNotification, notificationStore } from '@app/services';

import { useNotificationLog } from './useNotificationLog';
import { useUnreadCounts } from './useUnreadCounts';

describe('useUnreadCounts', () => {
  beforeEach(() => notificationStore.reset());
  afterEach(() => act(() => notificationStore.reset()));

  it('updates chat and notification subscribers only when their selected value changes', () => {
    const chatsRendered = vi.fn();
    const bellRendered = vi.fn();
    const fullRendered = vi.fn();
    const chats = renderHook(() => {
      chatsRendered();
      return useUnreadCounts((counts) => counts.chats);
    });
    const bell = renderHook(() => {
      bellRendered();
      return useUnreadCounts((counts) => counts.notifications);
    });
    const full = renderHook(() => {
      fullRendered();
      return useUnreadCounts();
    });
    const log = renderHook(() => useNotificationLog());
    const clearRenders = () => {
      chatsRendered.mockClear();
      bellRendered.mockClear();
      fullRendered.mockClear();
    };

    clearRenders();
    act(() => notificationStore.dispatch({ type: 'setDrawer', open: true }));
    expect(chatsRendered).not.toHaveBeenCalled();
    expect(bellRendered).not.toHaveBeenCalled();
    expect(fullRendered).toHaveBeenCalledTimes(1);
    expect(log.result.current.drawerOpen).toBe(true);

    clearRenders();
    act(() => notificationStore.dispatch({ type: 'bump', scope: 'rooms', key: 1 }));
    expect(chatsRendered).not.toHaveBeenCalled();
    expect(bellRendered).not.toHaveBeenCalled();
    expect(full.result.current.rooms).toEqual({ 1: 1 });

    act(() => notificationStore.dispatch({ type: 'bump', scope: 'chats', key: 'alice' }));
    expect(chatsRendered).toHaveBeenCalledTimes(1);
    expect(chats.result.current).toEqual({ alice: 1 });
    expect(bellRendered).not.toHaveBeenCalled();

    clearRenders();
    act(() => logNotification({ kind: 'buddy', actor: 'bob', target: { type: 'chat', userName: 'bob' } }));
    expect(chatsRendered).not.toHaveBeenCalled();
    expect(bellRendered).toHaveBeenCalledTimes(1);
    expect(bell.result.current).toBe(1);
    expect(log.result.current.entries).toHaveLength(1);

    clearRenders();
    act(() => logNotification({ kind: 'buddy', actor: 'carol', target: { type: 'chat', userName: 'carol' } }, true));
    expect(chatsRendered).not.toHaveBeenCalled();
    expect(bellRendered).not.toHaveBeenCalled();

    act(() => notificationStore.dispatch({ type: 'markAllRead' }));
    expect(bell.result.current).toBe(0);
    expect(bellRendered).toHaveBeenCalledTimes(1);
    act(() => notificationStore.dispatch({ type: 'clear', scope: 'chats', key: 'alice' }));
    expect(chats.result.current).toEqual({});
    expect(chatsRendered).toHaveBeenCalledTimes(1);
  });

  it('uses a replacement selector on rerender and retains the full-count subscription', () => {
    act(() => notificationStore.dispatch({ type: 'bump', scope: 'chats', key: 'alice' }));
    const { result, rerender } = renderHook(({ scope }: { scope: 'rooms' | 'chats' }) =>
      useUnreadCounts((counts) => counts[scope]), { initialProps: { scope: 'chats' } });
    expect(result.current).toEqual({ alice: 1 });
    rerender({ scope: 'rooms' });
    expect(result.current).toEqual({});
    act(() => notificationStore.dispatch({ type: 'bump', scope: 'rooms', key: 2 }));
    expect(result.current).toEqual({ 2: 1 });
  });
});
