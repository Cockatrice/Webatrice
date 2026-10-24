import { Profiler } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import { logNotification, notificationStore } from '@app/services';

import NotificationBell from './NotificationBell';

describe('NotificationBell', () => {
  beforeEach(() => notificationStore.reset());
  afterEach(() => act(() => notificationStore.reset()));

  it('renders for the unread notification count and drawer state, ignoring other count changes', () => {
    const rendered = vi.fn();
    renderWithProviders(<Profiler id="bell" onRender={rendered}><NotificationBell /></Profiler>);
    rendered.mockClear();
    act(() => notificationStore.dispatch({ type: 'bump', scope: 'chats', key: 'alice' }));
    act(() => notificationStore.dispatch({ type: 'bump', scope: 'rooms', key: 1 }));
    act(() => logNotification({ kind: 'buddy', actor: 'bob', target: { type: 'chat', userName: 'bob' } }, true));
    expect(rendered).not.toHaveBeenCalled();
    act(() => logNotification({ kind: 'buddy', actor: 'bob', target: { type: 'chat', userName: 'bob' } }));
    expect(rendered).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(notificationStore.getState().drawerOpen).toBe(true);
    act(() => notificationStore.dispatch({ type: 'markAllRead' }));
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });
});
