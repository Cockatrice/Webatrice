import { create, isFieldSet } from '@bufbuild/protobuf';
import {
  Event_NotifyUserSchema,
  Event_NotifyUser_NotificationType,
  Response_ReportStatsSchema,
  ServerInfo_ReportCommentSchema,
  ServerInfo_ReportSchema,
} from '@cockatrice/sockatrice/generated';

import { Actions } from './server.actions';
import { serverReducer } from './server.reducer';
import { makeReport, makeReportsState, makeServerState, makeUser } from '../../testing/fixtures/server';

describe('report reducers', () => {
  it('starts with nothing loaded', () => {
    const state = serverReducer(undefined, { type: '@@INIT' });
    expect(state.reports).toEqual(makeReportsState());
  });

  it('reportMyList stores rows by id and keeps the server order', () => {
    const rows = [makeReport({ reportId: 9 }), makeReport({ reportId: 4 })];
    const state = serverReducer(makeServerState(), Actions.reportMyList({ reports: rows }));
    expect(state.reports.mine).toEqual([9, 4]);
    expect(state.reports.byId[9]).toBe(rows[0]);
    expect(state.reports.byId[4]).toBe(rows[1]);
  });

  it('reportList stores the queue page and total count', () => {
    const rows = [makeReport({ reportId: 2 })];
    const state = serverReducer(makeServerState(), Actions.reportList({ reports: rows, totalCount: 40 }));
    expect(state.reports.queue).toEqual([2]);
    expect(state.reports.queueTotalCount).toBe(40);
  });

  it('a list refresh drops rows neither list holds, but keeps rows the other list holds', () => {
    let state = serverReducer(makeServerState(), Actions.reportMyList({ reports: [makeReport({ reportId: 1 })] }));
    state = serverReducer(state, Actions.reportList({
      reports: [makeReport({ reportId: 1 }), makeReport({ reportId: 2 })],
      totalCount: 2,
    }));
    state = serverReducer(state, Actions.reportList({ reports: [makeReport({ reportId: 3 })], totalCount: 1 }));
    expect(Object.keys(state.reports.byId).map(Number).sort()).toEqual([1, 3]);
  });

  it('reportDetails stores the full report and refreshes a listed row', () => {
    const listed = makeReport({ reportId: 5, status: 'open' });
    const detail = makeReport({
      reportId: 5,
      status: 'assigned',
      chatLog: '[12:00:00] mallory: hi',
      comments: [create(ServerInfo_ReportCommentSchema, { authorName: 'mod', commentText: 'looking', isModerator: true })],
    });
    let state = serverReducer(makeServerState(), Actions.reportMyList({ reports: [listed] }));
    state = serverReducer(state, Actions.reportDetails({ report: detail }));
    expect(state.reports.details[5]).toBe(detail);
    expect(state.reports.byId[5]).toBe(detail);
  });

  it('reportDetails for an unlisted report does not add a row', () => {
    const state = serverReducer(makeServerState(), Actions.reportDetails({ report: makeReport({ reportId: 8 }) }));
    expect(state.reports.details[8]).toBeDefined();
    expect(state.reports.byId[8]).toBeUndefined();
  });

  it('reportAssigned marks the row and details assigned to the caller with fresh messages', () => {
    const row = makeReport({ reportId: 5, status: 'open' });
    let state = serverReducer(
      makeServerState({ user: makeUser({ name: 'modA' }) }),
      Actions.reportList({ reports: [row], totalCount: 1 }),
    );
    const detail = create(ServerInfo_ReportSchema, { reportId: 5, chatLog: 'x' });
    state = serverReducer(state, Actions.reportDetails({ report: detail }));
    state = serverReducer(state, Actions.reportAssigned({ reportId: 5 }));
    expect(state.reports.byId[5]).not.toBe(detail);
    expect(state.reports.byId[5]).toMatchObject({ status: 'assigned', assignedModName: 'modA' });
    expect(state.reports.details[5]).toMatchObject({ status: 'assigned', assignedModName: 'modA', chatLog: 'x' });
    expect(detail.status).toBe('');
  });

  it('reportResolved sets resolved or dismissed', () => {
    let state = serverReducer(
      makeServerState(),
      Actions.reportList({ reports: [makeReport({ reportId: 1 }), makeReport({ reportId: 2 })], totalCount: 2 }),
    );
    state = serverReducer(state, Actions.reportResolved({ reportId: 1, dismissed: false }));
    state = serverReducer(state, Actions.reportResolved({ reportId: 2, dismissed: true }));
    expect(state.reports.byId[1].status).toBe('resolved');
    expect(state.reports.byId[2].status).toBe('dismissed');
  });

  it('reportAssigned and reportResolved ignore unknown reports', () => {
    const before = makeServerState();
    let state = serverReducer(before, Actions.reportResolved({ reportId: 99, dismissed: false }));
    state = serverReducer(state, Actions.reportAssigned({ reportId: 99 }));
    expect(state.reports).toEqual(before.reports);
  });

  it('keeps unset optional fields unset on a patched clone', () => {
    let state = serverReducer(makeServerState(), Actions.reportList({ reports: [makeReport({ reportId: 1 })], totalCount: 1 }));
    state = serverReducer(state, Actions.reportResolved({ reportId: 1, dismissed: false }));
    expect(isFieldSet(state.reports.byId[1], ServerInfo_ReportSchema.field.gameId)).toBe(false);
  });

  it('reportStats replaces the stats', () => {
    const stats = create(Response_ReportStatsSchema, { totalReports: 7 });
    const state = serverReducer(makeServerState(), Actions.reportStats({ stats }));
    expect(state.reports.stats).toBe(stats);
  });

  it('reportReplayDownloaded keeps the latest replay with its game id', () => {
    const replay = { gameId: 12, replayId: 3, replayData: new Uint8Array([1, 2]) };
    const state = serverReducer(makeServerState(), Actions.reportReplayDownloaded(replay));
    expect(state.reports.replay).toEqual({ gameId: 12, replayId: 3, replayData: new Uint8Array([1, 2]) });
  });

  it('reportNotified stores each notice as a new object so identical text still reads as new', () => {
    const notification = create(Event_NotifyUserSchema, {
      type: Event_NotifyUser_NotificationType.REPORT_COMMENT,
      customTitle: 'New Comment on Report #1',
    });
    const first = serverReducer(makeServerState(), Actions.reportNotified({ notification }));
    const second = serverReducer(first, Actions.reportNotified({ notification }));
    expect(second.reports.lastNotice).toEqual({ notification });
    expect(second.reports.lastNotice).not.toBe(first.reports.lastNotice);
  });

  it('disconnected and clearStore reset the reports', () => {
    let state = serverReducer(makeServerState(), Actions.reportMyList({ reports: [makeReport()] }));
    state = serverReducer(state, Actions.disconnected());
    expect(state.reports).toEqual(makeReportsState());
    state = serverReducer(state, Actions.reportMyList({ reports: [makeReport()] }));
    state = serverReducer(state, Actions.clearStore());
    expect(state.reports).toEqual(makeReportsState());
  });
});
