import { act, fireEvent, screen } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Event_NotifyUserSchema, Event_NotifyUser_NotificationType } from '@cockatrice/sockatrice/generated';
import type { Mock } from 'vitest';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { RouteEnum } from '../../types';
import { makeReport, reportsRootState, SERVER_30 } from './__mocks__/reportState';
import MyReports from './MyReports';

function renderMyReports(version?: string) {
  const webClient = createMockWebClient();
  const utils = renderWithProviders(
    <Routes>
      <Route path={RouteEnum.MY_REPORTS} element={<MyReports />} />
      <Route path={RouteEnum.SERVER} element={<div>lobby</div>} />
    </Routes>,
    { preloadedState: reportsRootState({ version }), webClient, route: RouteEnum.MY_REPORTS },
  );
  const session = webClient.request.session as unknown as Record<string, Mock>;
  const requestId = (command: string): string | undefined => session[command].mock.lastCall?.at(-1);
  return { ...utils, session, requestId };
}

describe('MyReports', () => {
  it('completes initial and repeated empty loads and enables refresh', () => {
    const { store, session, requestId } = renderMyReports();
    for (let request = 1; request <= 2; request++) {
      const refresh = screen.getByRole('button', { name: /Reports.refresh/ });
      expect(refresh).toBeDisabled();
      act(() => store.dispatch(server.Actions.reportMyList({ requestId: requestId('reportMyList'), reports: [] })));
      expect(screen.getByTestId('report-list-status').textContent).toBe('Reports.count');
      expect(refresh).toBeEnabled();
      fireEvent.click(refresh);
      expect(session.reportMyList).toHaveBeenCalledTimes(request + 1);
    }
  });

  it('falls back to the lobby on a 3.0 server and sends nothing', () => {
    const { session } = renderMyReports(SERVER_30);
    expect(screen.getByText('lobby')).toBeTruthy();
    expect(session.reportMyList).not.toHaveBeenCalled();
  });

  it('requests the list on open and shows it with a count once it lands', () => {
    const { session, store, requestId } = renderMyReports();
    expect(session.reportMyList).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('report-list-status').textContent).toBe('Reports.loading');
    act(() => {
      store.dispatch(server.Actions.reportMyList({ requestId: requestId('reportMyList'),
        reports: [makeReport({ reportId: 4, reportedUserName: 'mallory' })] }));
    });
    expect(screen.getByTestId('report-row-4')).toBeTruthy();
    expect(screen.getByTestId('report-list-status').textContent).toBe('Reports.count');
  });

  it('shows the failure line when the list cannot be loaded', () => {
    const { store, requestId } = renderMyReports();
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ requestId: requestId('reportMyList'),
        command: 'reportMyList', responseCode: 20, target: '' }));
    });
    expect(screen.getByTestId('report-list-status').textContent).toBe('Reports.loadFailed');
  });

  it('says the details failed only for the report whose lookup failed', () => {
    const { store, requestId } = renderMyReports();
    act(() => {
      store.dispatch(server.Actions.reportMyList({ requestId: requestId('reportMyList'), reports: [makeReport({ reportId: 4 })] }));
    });
    fireEvent.click(screen.getByTestId('report-row-4'));
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ requestId: requestId('reportDetails'),
        command: 'reportDetails', responseCode: 20, target: '5' }));
    });
    expect(screen.queryByText('Reports.thread.detailsFailed')).toBeNull();
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ requestId: requestId('reportDetails'),
        command: 'reportDetails', responseCode: 20, target: '4' }));
    });
    expect(screen.getByTestId('report-thread')).toHaveTextContent('Reports.thread.detailsFailed');
  });

  it('loads details for the selected report and sends a comment, then refreshes', () => {
    const { session, store, requestId } = renderMyReports();
    act(() => {
      store.dispatch(server.Actions.reportMyList({ requestId: requestId('reportMyList'),
        reports: [makeReport({ reportId: 4, status: 'assigned' })] }));
    });
    fireEvent.click(screen.getByTestId('report-row-4'));
    expect(session.reportDetails).toHaveBeenCalledWith(4, expect.any(String));
    act(() => {
      store.dispatch(server.Actions.reportDetails({ requestId: requestId('reportDetails'),
        report: makeReport({ reportId: 4, status: 'assigned', chatLog: 'log' }) }));
    });
    expect(screen.getByTestId('report-chat-log').textContent).toBe('log');

    fireEvent.change(screen.getByLabelText('Reports.thread.addComment'), { target: { value: ' any news? ' } });
    fireEvent.click(screen.getByRole('button', { name: /Reports.thread.send/ }));
    expect(session.reportAddComment).toHaveBeenCalledWith(4, 'any news?', expect.any(Function), expect.any(Function));

    act(() => session.reportAddComment.mock.calls[0][2]());
    expect(session.reportMyList).toHaveBeenCalledTimes(2);
    expect((screen.getByLabelText('Reports.thread.addComment') as HTMLInputElement).value).toBe('');
  });

  it('keeps the draft and says so when a comment fails', () => {
    const { session, store, requestId } = renderMyReports();
    act(() => {
      store.dispatch(server.Actions.reportMyList({ requestId: requestId('reportMyList'), reports: [makeReport({ reportId: 4 })] }));
    });
    fireEvent.click(screen.getByTestId('report-row-4'));
    fireEvent.change(screen.getByLabelText('Reports.thread.addComment'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /Reports.thread.send/ }));
    act(() => session.reportAddComment.mock.calls[0][3](12));
    expect(screen.getByRole('alert').textContent).toBe('Reports.thread.commentFailed');
    expect((screen.getByLabelText('Reports.thread.addComment') as HTMLInputElement).value).toBe('x');
  });

  it('refreshes when a report notification arrives', () => {
    const { session, store } = renderMyReports();
    act(() => {
      store.dispatch(server.Actions.reportNotified({
        notification: create(Event_NotifyUserSchema, { type: Event_NotifyUser_NotificationType.REPORT_RESOLVED }),
      }));
    });
    expect(session.reportMyList).toHaveBeenCalledTimes(2);
  });
});
