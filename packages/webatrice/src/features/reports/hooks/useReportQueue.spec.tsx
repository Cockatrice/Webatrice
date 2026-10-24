import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Response_ReportStatsSchema, Response_ReportUserInfoSchema } from '@cockatrice/sockatrice/generated';
import { createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { makeReport, reportsRootState } from '../__mocks__/reportState';
import { useReportQueue, type ReportQueue } from './useReportQueue';

const watchReplay = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks/useWatchReplay', () => ({ useWatchReplay: () => watchReplay }));

function setup() {
  const webClient = createMockWebClient();
  let current!: ReportQueue;
  function Probe() {
    current = useReportQueue();
    return null;
  }
  const view = renderWithProviders(<Probe />, { webClient, preloadedState: reportsRootState({ moderator: true }) });
  const moderator = vi.mocked(webClient.request.moderator, true);
  const row = makeReport({ reportId: 1, status: 'open', reportedUserName: 'alice', gameId: 7, replayId: 8 });
  act(() => view.store.dispatch(server.Actions.reportList({ reports: [row], totalCount: 1,
    requestId: moderator.reportList.mock.lastCall?.[3] })));
  act(() => current.select(1));
  return { ...view, get: () => current, moderator, row, reopen: () => view.rerender(<Probe key="reopened" />) };
}

function run(view: ReturnType<typeof setup>, operation: 'assign' | 'resolve' | 'viewReplay') {
  act(() => view.get()[operation]());
}

it.each(['refresh', 'other-caller'] as const)('only settles the current statistics request after %s', (origin) => {
  const view = setup();
  const oldId = view.moderator.reportStats.mock.lastCall?.[0];
  if (origin === 'refresh') {
    act(() => view.get().refresh());
  }
  const currentId = view.moderator.reportStats.mock.lastCall?.[0];
  const requestId = origin === 'other-caller' ? 'other' : oldId;
  const stats = create(Response_ReportStatsSchema, { totalReports: 9 });
  act(() => view.store.dispatch(server.Actions.reportStats({ stats, requestId })));
  expect(server.Selectors.getReportStats(view.store.getState())).toBe(stats);
  expect(view.get().statsState).toBe('loading');
  act(() => view.store.dispatch(server.Actions.moderatorCommandFailed({ command: 'reportStats', target: '', responseCode: 7, requestId })));
  expect(view.get().statsState).toBe('loading');
  act(() => view.store.dispatch(server.Actions.reportStats({ stats, requestId: currentId })));
  expect(view.get().statsState).toBe('ready');
  expect(view.moderator.reportStats).toHaveBeenCalledTimes(origin === 'other-caller' ? 1 : 2);
});

it.each(['refresh', 'selection', 'other-caller'] as const)('does not show an unrelated user-info failure after %s', (origin) => {
  const view = setup();
  const oldId = view.moderator.reportUserInfo.mock.lastCall?.[1];
  if (origin === 'refresh') {
    act(() => view.get().refresh());
  }
  if (origin === 'selection') {
    act(() => view.get().select(2)); act(() => view.get().select(1));
  }
  const requestId = origin === 'other-caller' ? 'other' : oldId;
  act(() => view.store.dispatch(server.Actions.moderatorCommandFailed({
    command: 'reportUserInfo', target: 'alice', responseCode: 7, requestId,
  })));
  expect(view.get().userInfoFailed).toBe(false);
  if (origin !== 'refresh') {
    const info = create(Response_ReportUserInfoSchema, { userName: 'alice', adminNotes: 'store data' });
    act(() => view.store.dispatch(server.Actions.userInfoReport({ info, requestId })));
    expect(server.Selectors.getUserInvestigation(view.store.getState(), 'alice')?.info).toBe(info);
    act(() => view.store.dispatch(server.Actions.moderatorCommandFailed({
      command: 'reportUserInfo', target: 'alice', responseCode: 7, requestId: view.moderator.reportUserInfo.mock.lastCall?.[1],
    })));
    expect(view.get().userInfoFailed).toBe(true);
  }
  expect(view.moderator.reportUserInfo).toHaveBeenCalledTimes(origin === 'selection' ? 2 : 1);
});

it.each(['assign', 'resolve', 'viewReplay'] as const)('%s ignores another caller and a reply from before refresh', (operation) => {
  const view = setup();
  const command = operation === 'assign' ? 'reportAssign' : operation === 'resolve' ? 'reportResolve' : 'replayDownloadByGameId';
  const request = view.moderator[command];
  const requestId = () => request.mock.lastCall?.at(-1) as string | undefined;
  const reply = (id?: string) => operation === 'assign' ? server.Actions.reportAssigned({ reportId: 1, requestId: id })
    : operation === 'resolve' ? server.Actions.reportResolved({ reportId: 1, dismissed: false, requestId: id })
      : server.Actions.reportReplayDownloaded({ gameId: 7, replayId: 8, replayData: new Uint8Array([1]), requestId: id });
  run(view, operation);
  const oldId = requestId();
  act(() => view.get().refresh());
  expect(view.get().actions.canResolve).toBe(true);
  run(view, operation);
  const currentId = requestId();
  const message = view.get().actionMessage;
  for (const id of ['other', undefined, oldId]) {
    act(() => view.store.dispatch(server.Actions.moderatorCommandFailed({
      command, target: operation === 'viewReplay' ? '7' : '1', responseCode: 7, requestId: id,
    })));
    expect(view.get().actionMessage).toBe(message);
    expect(view.get().actions.canResolve).toBe(false);
    act(() => view.store.dispatch(reply(id)));
    expect(view.get().actionMessage).toBe(message);
    expect(watchReplay).not.toHaveBeenCalled();
    expect(view.moderator.reportList).toHaveBeenCalledTimes(2);
  }
  act(() => view.store.dispatch(reply(currentId)));
  expect(view.get().actionMessage).toBe(operation === 'assign' ? 'assignedDone' : operation === 'resolve' ? 'done' : 'replayOpened');
  expect(view.moderator.reportList).toHaveBeenCalledTimes(operation === 'viewReplay' ? 2 : 3);
  expect(watchReplay).toHaveBeenCalledTimes(operation === 'viewReplay' ? 1 : 0);
});

it.each(['assign', 'resolve', 'viewReplay'] as const)('%s abandons its notice when selection changes', (operation) => {
  const view = setup();
  run(view, operation);
  const command = operation === 'assign' ? 'reportAssign' : operation === 'resolve' ? 'reportResolve' : 'replayDownloadByGameId';
  const requestId = view.moderator[command].mock.lastCall?.at(-1) as string | undefined;
  act(() => view.get().select(2));
  act(() => view.get().select(1));
  expect(view.get().actionMessage).toBeNull();
  act(() => view.store.dispatch(server.Actions.moderatorCommandFailed({
    command, target: operation === 'viewReplay' ? '7' : '1', responseCode: 7, requestId,
  })));
  expect(view.get().actionMessage).toBeNull();
  expect(view.get().actions.canResolve).toBe(true);
  expect(view.moderator.reportList).toHaveBeenCalledTimes(1);
});


it.each(['assign', 'resolve', 'viewReplay'] as const)('%s ignores the previous mount and settles its current failure', (operation) => {
  const view = setup();
  const command = operation === 'assign' ? 'reportAssign' : operation === 'resolve' ? 'reportResolve' : 'replayDownloadByGameId';
  run(view, operation);
  const oldId = view.moderator[command].mock.lastCall?.at(-1) as string | undefined;
  view.reopen();
  act(() => view.get().select(1));
  run(view, operation);
  const currentId = view.moderator[command].mock.lastCall?.at(-1) as string | undefined;
  const message = view.get().actionMessage;
  const reply = operation === 'assign' ? server.Actions.reportAssigned({ reportId: 1, requestId: oldId })
    : operation === 'resolve' ? server.Actions.reportResolved({ reportId: 1, dismissed: false, requestId: oldId })
      : server.Actions.reportReplayDownloaded({ gameId: 7, replayId: 8, replayData: new Uint8Array([1]), requestId: oldId });
  act(() => view.store.dispatch(reply));
  expect(view.get().actionMessage).toBe(message);
  expect(view.moderator.reportList).toHaveBeenCalledTimes(2);
  expect(watchReplay).not.toHaveBeenCalled();
  act(() => view.store.dispatch(server.Actions.moderatorCommandFailed({
    command, target: operation === 'viewReplay' ? '7' : '1', responseCode: 7, requestId: currentId,
  })));
  expect(view.get().actionMessage).toBe(operation === 'assign' ? 'assignFailed' : operation === 'resolve' ? 'actionFailed' : 'noReplay');
  expect(view.moderator.reportList).toHaveBeenCalledTimes(2);
});
