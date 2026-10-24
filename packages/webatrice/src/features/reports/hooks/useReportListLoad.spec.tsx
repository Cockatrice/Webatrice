import { act } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import { createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { makeReport, reportsRootState } from '../__mocks__/reportState';
import { useMyReports, type MyReports } from './useMyReports';

function setup() {
  const webClient = createMockWebClient();
  let current!: MyReports;
  function Probe() {
    current = useMyReports();
    return null;
  }
  const view = renderWithProviders(<Probe />, { webClient, preloadedState: reportsRootState() });
  return { ...view, get: () => current, request: vi.mocked(webClient.request.session.reportMyList),
    reopen: () => view.rerender(<Probe key="reopened" />) };
}

it.each(['refresh', 'reopen', 'other-caller', 'uncorrelated'] as const)(
  'does not settle a list from %s while the store still accepts its rows', (origin) => {
    const view = setup();
    const oldId = view.request.mock.lastCall?.[0];
    if (origin === 'reopen') {
      view.reopen();
    } else if (origin === 'refresh') {
      act(() => view.get().refresh());
    }
    const currentId = view.request.mock.lastCall?.[0];
    const requestId = origin === 'other-caller' ? 'another-view' : origin === 'uncorrelated' ? undefined : oldId;
    const row = makeReport({ reportId: 7 });
    act(() => view.store.dispatch(server.Actions.reportMyList({ reports: [row], requestId })));
    expect(view.get().reports).toEqual([row]);
    expect(view.get().loadState).toBe('loading');
    act(() => view.store.dispatch(server.Actions.sessionCommandFailed({
      command: 'reportMyList', target: '', responseCode: 7, requestId,
    })));
    expect(view.get().loadState).toBe('loading');
    act(() => view.store.dispatch(server.Actions.reportMyList({ reports: [], requestId: currentId })));
    expect(view.get().loadState).toBe('ready');
    expect(view.get().reports).toEqual([]);
    expect(view.request).toHaveBeenCalledTimes(origin === 'refresh' || origin === 'reopen' ? 2 : 1);
  },
);

it('ignores another list success but settles its own failure, then allows an empty retry', () => {
  const view = setup();
  const requestId = view.request.mock.lastCall?.[0];
  act(() => view.store.dispatch(server.Actions.reportMyList({ reports: [], requestId: 'other' })));
  expect(view.get().loadState).toBe('loading');
  act(() => view.store.dispatch(server.Actions.sessionCommandFailed({ command: 'reportMyList', target: '', responseCode: 7, requestId })));
  expect(view.get().loadState).toBe('failed');
  act(() => view.get().refresh());
  act(() => view.store.dispatch(server.Actions.reportMyList({ reports: [], requestId: view.request.mock.lastCall?.[0] })));
  expect(view.get().loadState).toBe('ready');
  expect(view.request).toHaveBeenCalledTimes(2);
});
