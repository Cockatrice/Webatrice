import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const { showSystemNotification } = vi.hoisted(() => ({ showSystemNotification: vi.fn() }));
vi.mock('@app/services', async (importOriginal) => ({ ...await importOriginal<object>(), showSystemNotification }));

import { ToastProvider } from '../Toast';
import { notificationStore, type NotificationInput } from '../../services/notifications/notificationStore';
import { getChatDockState } from '../../hooks/useChatDock';
import { useNotify } from './useNotify';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={children} />
        <Route path="/player/:name" element={<p>chat page</p>} />
      </Routes>
    </MemoryRouter>
  </ToastProvider>
);

const message: NotificationInput = { kind: 'message', actor: 'bob', body: 'hi', target: { type: 'chat', userName: 'bob' } };

describe('useNotify', () => {
  beforeEach(() => {
    notificationStore.reset();
    showSystemNotification.mockReset();
  });

  it('logs the entry and uses an OS notification when one is shown, with no toast', () => {
    showSystemNotification.mockReturnValue(true);
    const { result } = renderHook(() => useNotify(), { wrapper });

    let outcome;
    act(() => {
      outcome = result.current({ entry: message, tag: 'pm:bob', system: true, toast: true });
    });

    expect(outcome).toBe('system');
    expect(showSystemNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Notifications.system.message', body: 'hi', tag: 'pm:bob',
    }));
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    expect(notificationStore.getState().entries).toEqual([expect.objectContaining({ kind: 'message', actor: 'bob', read: false })]);
  });

  it('falls back to a toast whose action opens the chat in the dock and marks the entry read', () => {
    showSystemNotification.mockReturnValue(false);
    const { result } = renderHook(() => useNotify(), { wrapper });

    act(() => {
      expect(result.current({ entry: message, system: true, toast: true })).toBe('toast');
    });

    expect(screen.getByTestId('toast')).toHaveTextContent('hi');
    fireEvent.click(screen.getByRole('button', { name: 'Notifications.action.message' }));
    expect(getChatDockState()).toEqual(expect.objectContaining({
      chats: expect.arrayContaining([expect.objectContaining({ name: 'bob' })]),
    }));
    expect(screen.queryByText('chat page')).not.toBeInTheDocument();
    expect(notificationStore.getState().entries[0].read).toBe(true);
  });

  it('skips the OS notification when the user turned the popup off', () => {
    const { result } = renderHook(() => useNotify(), { wrapper });

    act(() => {
      result.current({ entry: message, system: false, toast: true });
    });

    expect(showSystemNotification).not.toHaveBeenCalled();
  });

  it('only logs when neither path is wanted, as read when it was seen in place', () => {
    showSystemNotification.mockReturnValue(false);
    const { result } = renderHook(() => useNotify(), { wrapper });

    act(() => {
      expect(result.current({ entry: message, system: true, toast: false, read: true })).toBe('none');
    });
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    expect(notificationStore.getState().entries[0].read).toBe(true);
  });
});

describe('NotificationToast', () => {
  it('puts the title and body on one line', async () => {
    const { default: NotificationToast } = await import('./NotificationToast');
    render(<NotificationToast title="bob:" body="hello" />);
    expect(screen.getByText('bob:').closest('p')).toHaveTextContent('bob: hello');
  });
});
