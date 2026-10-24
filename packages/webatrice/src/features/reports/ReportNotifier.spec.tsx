import { act, fireEvent, screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Event_NotifyUserSchema, Event_NotifyUser_NotificationType } from '@cockatrice/sockatrice/generated';

import { renderWithProviders } from '../../__test-utils__';
import { RouteEnum } from '../../types';
import { reportsRootState } from './__mocks__/reportState';
import ReportNotifier from './ReportNotifier';
import { notificationStore } from '../../services/notifications/notificationStore';

const Type = Event_NotifyUser_NotificationType;

function renderNotifier(moderator = false) {
  return renderWithProviders(
    <>
      <ReportNotifier />
      <Routes>
        <Route path={RouteEnum.SERVER} element={<div>lobby</div>} />
        <Route path={RouteEnum.MY_REPORTS} element={<div>my reports page</div>} />
        <Route path={RouteEnum.REPORT_QUEUE} element={<div>queue page</div>} />
      </Routes>
    </>,
    { preloadedState: reportsRootState({ moderator }), route: RouteEnum.SERVER },
  );
}

function notice(type: Event_NotifyUser_NotificationType, customTitle: string, customContent: string) {
  return server.Actions.reportNotified({ notification: create(Event_NotifyUserSchema, { type, customTitle, customContent }) });
}

const toasts = () => screen.queryAllByTestId('toast');

describe('ReportNotifier', () => {
  beforeEach(() => {
    notificationStore.reset();
  });

  it('pops up the server title and content, logs it, and opens My Reports from the action', () => {
    const { store } = renderNotifier();
    act(() => {
      store.dispatch(notice(Type.REPORT_RESOLVED, 'Report Resolved', 'Your report about mallory has been resolved.\nNote: warned'));
    });
    const [toast] = toasts();
    expect(toast.textContent).toContain('Note: warned');
    expect(notificationStore.getState().entries[0]).toMatchObject({ kind: 'report', title: 'Report Resolved' });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications.action.report' }));
    expect(screen.getByText('my reports page')).toBeTruthy();
  });

  it('lets the toast leave after six seconds while the log keeps the notice', () => {
    vi.useFakeTimers();
    try {
      const { store } = renderNotifier();
      act(() => {
        store.dispatch(notice(Type.REPORT_RESOLVED, 'Report Resolved', 'Your report has been resolved.'));
      });

      act(() => {
        vi.advanceTimersByTime(6_000);
      });

      expect(toasts()).toHaveLength(0);
      expect(notificationStore.getState().entries).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the queue for a moderator comment notice', () => {
    const { store } = renderNotifier(true);
    act(() => {
      store.dispatch(notice(Type.REPORT_COMMENT, 'New Comment on Report #3', 'alice commented:\nmore'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications.action.report' }));
    expect(screen.getByText('queue page')).toBeTruthy();
  });

  it('still pops up the first notice after a reconnect resets the reports slice', () => {
    const { store } = renderNotifier();
    act(() => {
      store.dispatch(notice(Type.REPORT_RESOLVED, 'Report Resolved', 'first session'));
    });
    act(() => {
      store.dispatch(server.Actions.disconnected());
    });
    act(() => {
      store.dispatch(notice(Type.REPORT_RESOLVED, 'Report Resolved', 'second session'));
    });
    const shown = toasts().map((toast) => toast.textContent);
    expect(shown).toHaveLength(2);
    expect(shown.join()).toContain('second session');
  });

  it('skips a notice with a blank title or content, like desktop', () => {
    const { store } = renderNotifier();
    act(() => {
      store.dispatch(notice(Type.REPORT_COMMENT, '   ', 'text'));
    });
    expect(toasts()).toHaveLength(0);
    expect(notificationStore.getState().entries).toHaveLength(0);
  });
});
