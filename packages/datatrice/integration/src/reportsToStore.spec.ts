import '@cockatrice/sockatrice/testing/setup-hooks';
import { create } from '@bufbuild/protobuf';
import { vi } from 'vitest';
import { ModeratorCommands, SessionCommands, WebClient } from '@cockatrice/sockatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import {
  buildResponse, buildResponseMessage, connectAndLogin, deliverMessage,
  findLastModeratorCommand, findLastSessionCommand, getMockWebSocket,
} from '@cockatrice/sockatrice/testing';
import { attachResponseHandlers, createStore, games, server, type RootState } from '../../src';
import { makeServerState } from '../../src/testing/fixtures/server';

import {
  Event_NotifyUserSchema,
  Event_NotifyUser_NotificationType,
  Response_ReplayDownloadByGameIdSchema,
  Response_ReportStatsSchema,
  Response_ReportUserInfoSchema,
  ServerInfo_ReportSchema,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';

function setup() {
  connectAndLogin();
  const store = createStore();
  WebClient.instance.response = attachResponseHandlers(store);
  getMockWebSocket().send.mockClear();
  return store;
}

function loadQueue(reports: Data.ServerInfo_Report[], totalCount = reports.length) {
  ModeratorCommands.reportList(false, 0, 10, 'queue');
  const { cmdId, value } = findLastModeratorCommand(Data.Command_ReportList_ext);
  expect({ ...value }).toEqual({ $typeName: value.$typeName, unresolvedOnly: false, offset: 0, limit: 10 });
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId, ext: Data.Response_ReportList_ext, value: create(Data.Response_ReportListSchema, { reports, totalCount }),
  })));
}

function loadMine(reports: Data.ServerInfo_Report[]) {
  SessionCommands.reportMyList('mine');
  const { cmdId, value } = findLastSessionCommand(Data.Command_ReportMyList_ext);
  expect({ ...value }).toEqual({ $typeName: value.$typeName });
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId, ext: Data.Response_ReportMyList_ext, value: create(Data.Response_ReportMyListSchema, { reports }),
  })));
}

function loadDetails(report: Data.ServerInfo_Report) {
  SessionCommands.reportDetails(report.reportId, 'detail');
  const { cmdId, value } = findLastSessionCommand(Data.Command_ReportDetails_ext);
  expect({ ...value }).toEqual({ $typeName: value.$typeName, reportId: report.reportId });
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId, ext: Data.Response_ReportDetails_ext, value: create(Data.Response_ReportDetailsSchema, { report }),
  })));
}

function report(reportId: number, status: string) {
  return create(ServerInfo_ReportSchema, { reportId, status, reportedUserName: 'mallory', reporterName: 'alice' });
}

describe('integration: report handlers', () => {
  it('a reporter follows a report from filing to resolution', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.reportMyList?.([report(1, 'open')]);
    expect(server.Selectors.getMyReports(store.getState()).map((r) => r.status)).toEqual(['open']);

    response.session.notifyUser(create(Event_NotifyUserSchema, {
      type: Event_NotifyUser_NotificationType.REPORT_RESOLVED,
      customTitle: 'Report Resolved',
      customContent: 'Your report about mallory has been resolved.',
    }));
    expect(server.Selectors.getLastReportNotice(store.getState())?.notification.customTitle).toBe('Report Resolved');

    response.session.reportMyList?.([create(ServerInfo_ReportSchema, { ...report(1, 'resolved'), resolutionNote: 'warned' })]);
    expect(server.Selectors.getMyReports(store.getState())[0]).toMatchObject({ status: 'resolved', resolutionNote: 'warned' });
  });

  it('a moderator works the queue: list, details, assign, resolve, context and stats', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUser(create(ServerInfo_UserSchema, { name: 'modA' }));

    response.moderator.reportList?.([report(1, 'open'), report(2, 'assigned')], 2);
    expect(server.Selectors.getReportQueueStatusCounts(store.getState())).toEqual({ open: 1, assigned: 1, resolved: 0, dismissed: 0 });

    response.session.reportDetails?.(create(ServerInfo_ReportSchema, { ...report(1, 'open'), chatLog: 'log' }));
    response.moderator.reportAssigned?.(1);
    expect(server.Selectors.getReportDetails(store.getState(), 1))
      .toMatchObject({ status: 'assigned', assignedModName: 'modA', chatLog: 'log' });

    response.moderator.reportResolved?.(1, true);
    expect(server.Selectors.getReport(store.getState(), 1)?.status).toBe('dismissed');

    store.dispatch(server.Actions.userInvestigationStarted({ userName: 'mallory' }));
    response.moderator.reportUserInfo?.(create(Response_ReportUserInfoSchema, { userName: 'mallory', totalReports: 2 }));
    response.moderator.reportStats?.(create(Response_ReportStatsSchema, { totalReports: 2 }));
    response.moderator.replayDownloadedByGameId?.(5, create(Response_ReplayDownloadByGameIdSchema, {
      replayId: 8,
      replayData: new Uint8Array([1]),
    }));
    expect(server.Selectors.getUserInvestigation(store.getState(), 'mallory')?.info?.totalReports).toBe(2);
    expect(server.Selectors.getReportStats(store.getState())?.totalReports).toBe(2);
    expect(server.Selectors.getReportReplay(store.getState())).toEqual({ gameId: 5, replayId: 8, replayData: new Uint8Array([1]) });
  });
});

describe('integration: report queue outcomes', () => {
  it('prunes unreferenced rows on a queue reload while retaining the reports belonging to the caller', () => {
    const store = setup();
    const first = create(Data.ServerInfo_ReportSchema, { reportId: 1, status: 'open' });
    const second = create(Data.ServerInfo_ReportSchema, { reportId: 2, status: 'open' });
    loadMine([first]);
    expect(store.getState().server.reports.byId).toEqual({ 1: first });
    loadQueue([first, second], 20);
    expect(store.getState().server.reports.byId).toEqual({ 1: first, 2: second });
    expect(server.Selectors.getReportQueueTotalCount(store.getState())).toBe(20);
    expect(server.Selectors.getReportQueue(store.getState())).toEqual([first, second]);
    loadQueue([]);
    expect(store.getState().server.reports.byId).toEqual({ 1: first });
    expect(server.Selectors.getMyReports(store.getState())).toEqual([first]);
    expect(server.Selectors.getReportQueue(store.getState())).toEqual([]);
    expect(getMockWebSocket().send.mock.calls).toHaveLength(3);
  });

  it('assigns listed and detailed reports with fresh messages and ignores unknown ids', () => {
    const store = setup();
    const first = create(Data.ServerInfo_ReportSchema, { reportId: 1, status: 'open', assignedModName: 'old-mod' });
    const second = create(Data.ServerInfo_ReportSchema, { reportId: 2, status: 'open', chatLog: 'saved chat' });
    loadQueue([first]);
    loadDetails(second);
    const originalRow = store.getState().server.reports.byId[1];
    const originalDetail = store.getState().server.reports.details[2];
    expect(originalRow).toEqual(first);
    expect(originalDetail).toEqual(second);
    expect(store.getState().server.user).toBeNull();
    const consoleError = vi.spyOn(console, 'error');
    try {
      for (const reportId of [1, 2, 99]) {
        ModeratorCommands.reportAssign(reportId, 'assign');
        const { cmdId, value } = findLastModeratorCommand(Data.Command_ReportAssign_ext);
        expect({ ...value }).toEqual({ $typeName: value.$typeName, reportId });
        deliverMessage(buildResponseMessage(buildResponse({ cmdId })));
      }
      expect(store.getState().server.reports.byId).toEqual({
        1: create(Data.ServerInfo_ReportSchema, { reportId: 1, status: 'assigned', assignedModName: '' }),
      });
      expect(store.getState().server.reports.details).toEqual({
        2: create(Data.ServerInfo_ReportSchema, { reportId: 2, status: 'assigned', assignedModName: '', chatLog: 'saved chat' }),
      });
      expect(store.getState().server.reports.byId[1]).not.toBe(originalRow);
      expect(store.getState().server.reports.details[2]).not.toBe(originalDetail);
      expect(originalRow).toEqual(first);
      expect(originalDetail).toEqual(second);
      expect(getMockWebSocket().send.mock.calls).toHaveLength(5);
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('retains resolved details after a queue reload removes the listed row', () => {
    const store = setup();
    const report = create(Data.ServerInfo_ReportSchema, { reportId: 2, status: 'open', chatLog: 'saved chat' });
    loadQueue([report]);
    loadDetails(report);
    expect(store.getState().server.reports.byId).toEqual({ 2: report });
    expect(store.getState().server.reports.details).toEqual({ 2: report });
    ModeratorCommands.reportResolve(2, 'checked');
    const { cmdId, value } = findLastModeratorCommand(Data.Command_ReportResolve_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, reportId: 2, resolutionNote: 'checked', dismissed: false });
    deliverMessage(buildResponseMessage(buildResponse({ cmdId })));
    const resolved = create(Data.ServerInfo_ReportSchema, { reportId: 2, status: 'resolved', chatLog: 'saved chat' });
    expect(store.getState().server.reports.byId).toEqual({ 2: resolved });
    expect(store.getState().server.reports.details).toEqual({ 2: resolved });
    loadQueue([]);
    expect(store.getState().server.reports.byId).toEqual({});
    expect(store.getState().server.reports.details).toEqual({ 2: resolved });
    expect(getMockWebSocket().send.mock.calls).toHaveLength(4);
  });

  it('filters loaded rows by each searchable field and exact status and counts every lifecycle state', () => {
    const store = setup();
    const rows = [
      create(Data.ServerInfo_ReportSchema, { reportId: 1, reporterName: 'Alice', status: 'open' }),
      create(Data.ServerInfo_ReportSchema, { reportId: 2, reportedUserName: 'Mallory', status: 'assigned' }),
      create(Data.ServerInfo_ReportSchema, { reportId: 3, category: 'Spam', status: 'resolved' }),
      create(Data.ServerInfo_ReportSchema, { reportId: 4, description: 'Bad language', status: 'dismissed' }),
      create(Data.ServerInfo_ReportSchema, { reportId: 5, status: 'future' }),
    ];
    loadQueue(rows);
    const loaded = server.Selectors.getReportQueue(store.getState());
    expect(loaded).toEqual(rows);
    expect(server.filterReports(loaded, '', '')).toBe(loaded);
    for (const [search, expected] of [['ALICE', rows[0]], ['MALLORY', rows[1]], ['SPAM', rows[2]], ['LANGUAGE', rows[3]]] as const) {
      expect(server.filterReports(loaded, search, '')).toEqual([expected]);
    }
    expect(server.filterReports(loaded, '', 'assigned')).toEqual([rows[1]]);
    expect(server.filterReports(loaded, 'spam', 'resolved')).toEqual([rows[2]]);
    expect(server.filterReports(loaded, 'spam', 'open')).toEqual([]);
    expect(server.filterReports(loaded, 'absent', '')).toEqual([]);
    expect(server.filterReports(loaded, '', 'OPEN')).toEqual([]);
    expect(loaded.map(row => server.isReportOpen(row.status))).toEqual([true, true, false, false, false]);
    expect(server.Selectors.getReportQueueStatusCounts(store.getState())).toEqual({ open: 1, assigned: 1, resolved: 1, dismissed: 1 });
    expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
  });

  it('clears a previous replay before sending a new download and dispatches exact failures', () => {
    const store = setup();
    ModeratorCommands.replayDownloadByGameId(77, 'first');
    const first = findLastModeratorCommand(Data.Command_ReplayDownloadByGameId_ext);
    expect({ ...first.value }).toEqual({ $typeName: first.value.$typeName, gameId: 77 });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: first.cmdId, ext: Data.Response_ReplayDownloadByGameId_ext,
      value: create(Data.Response_ReplayDownloadByGameIdSchema, { replayId: 8, replayData: new Uint8Array([1, 2]) }),
    })));
    expect(store.getState().server.reports.replay).toEqual({ gameId: 77, replayId: 8, replayData: new Uint8Array([1, 2]) });
    const dispatch = vi.spyOn(store, 'dispatch');
    try {
      ModeratorCommands.replayDownloadByGameId(77, 'retry');
      const retry = findLastModeratorCommand(Data.Command_ReplayDownloadByGameId_ext);
      expect({ ...retry.value }).toEqual({ $typeName: retry.value.$typeName, gameId: 77 });
      expect(store.getState().server.reports.replay).toBeNull();
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: retry.cmdId, responseCode: Data.Response_ResponseCode.RespNameNotFound,
      })));
      SessionCommands.reportDetails(4, 'detail');
      const detail = findLastSessionCommand(Data.Command_ReportDetails_ext);
      expect({ ...detail.value }).toEqual({ $typeName: detail.value.$typeName, reportId: 4 });
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: detail.cmdId, responseCode: Data.Response_ResponseCode.RespAccessDenied,
      })));
      expect(dispatch.mock.calls).toEqual([
        [server.Actions.reportReplayRequested()],
        [server.Actions.moderatorCommandFailed({
          command: 'replayDownloadByGameId', responseCode: Data.Response_ResponseCode.RespNameNotFound,
          target: '77', failure: undefined, requestId: 'retry',
        })],
        [server.Actions.sessionCommandFailed({
          command: 'reportDetails', responseCode: Data.Response_ResponseCode.RespAccessDenied,
          target: '4', failure: undefined, requestId: 'detail',
        })],
      ]);
      expect(store.getState().server.reports.replay).toBeNull();
      expect(store.getState().server.reports.details).toEqual({});
      expect(getMockWebSocket().send.mock.calls).toHaveLength(3);
    } finally {
      dispatch.mockRestore();
    }
  });

  it('distinguishes unloaded lists from loaded empty lists', () => {
    const store = setup();
    expect(server.Selectors.getMyReports(store.getState())).toEqual([]);
    expect(server.Selectors.getReportQueue(store.getState())).toEqual([]);
    expect(server.Selectors.getMyReportsLoaded(store.getState())).toBe(false);
    expect(server.Selectors.getReportQueueLoaded(store.getState())).toBe(false);
    loadMine([]);
    loadQueue([]);
    expect(store.getState().server.reports.mine).toEqual([]);
    expect(store.getState().server.reports.queue).toEqual([]);
    expect(server.Selectors.getMyReportsLoaded(store.getState())).toBe(true);
    expect(server.Selectors.getReportQueueLoaded(store.getState())).toBe(true);
    expect(getMockWebSocket().send.mock.calls).toHaveLength(2);
  });

  it('reads report defaults from a preloaded server state that predates reports', () => {
    const legacy = makeServerState();
    Reflect.deleteProperty(legacy, 'reports');
    const oldStore = createStore<RootState>({ preloadedState: { server: legacy } });
    expect(oldStore.getState().server).not.toHaveProperty('reports');
    expect(server.Selectors.getMyReports(oldStore.getState())).toEqual([]);
    expect(server.Selectors.getReportQueueLoaded(oldStore.getState())).toBe(false);
    expect(server.Selectors.getReportQueueTotalCount(oldStore.getState())).toBe(0);
    expect(server.Selectors.getReportStats(oldStore.getState())).toBeNull();
  });

  it('returns stable empty messages for a game absent from the store', () => {
    const store = createStore();
    const messages = games.Selectors.getMessages(store.getState(), 404);
    expect(messages).toEqual([]);
    expect(games.Selectors.getMessages(store.getState(), 405)).toBe(messages);
  });
});
