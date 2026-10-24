import { act, fireEvent, render, screen } from '@testing-library/react';

const { getNotificationPermission, requestNotificationPermission, watchNotificationPermission } = vi.hoisted(() => ({
  getNotificationPermission: vi.fn(),
  requestNotificationPermission: vi.fn(),
  watchNotificationPermission: vi.fn(() => () => {}),
}));
vi.mock('@app/services', () => ({ getNotificationPermission, requestNotificationPermission, watchNotificationPermission }));

import NotificationPermissionControl from './NotificationPermissionControl';

const renderControl = () => render(<NotificationPermissionControl id="n" labelId="n-label" disabled={false} />);

describe('NotificationPermissionControl', () => {
  it('asks for permission only when clicked, then shows the answer', async () => {
    getNotificationPermission.mockReturnValue('default');
    requestNotificationPermission.mockResolvedValue('granted');
    renderControl();

    expect(requestNotificationPermission).not.toHaveBeenCalled();
    expect(screen.getByText(/status\.default/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /browserNotifications\.request/ }));
    });

    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/status\.granted/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('follows a change made in the browser\'s site settings', () => {
    getNotificationPermission.mockReturnValue('default');
    renderControl();
    const [[onChange]] = watchNotificationPermission.mock.calls as unknown as [[(p: string) => void]];

    act(() => onChange('denied'));

    expect(screen.getByText(/status\.denied/)).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(['denied', 'unsupported'])('explains %s with no button to press', (permission) => {
    getNotificationPermission.mockReturnValue(permission);
    renderControl();

    expect(screen.getByText(new RegExp(`status\\.${permission}`))).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
