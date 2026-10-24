import { create } from '@bufbuild/protobuf';
import { Response_ReportStatsSchema } from '@cockatrice/sockatrice/generated';

import { Selectors } from './server.selectors';
import { ServerState } from './server.interfaces';
import { makeReport, makeReportsState, makeServerState } from '../../testing/fixtures/server';

function rootState(server: ServerState) {
  return { server };
}

describe('report selectors', () => {
  const a = makeReport({ reportId: 1, status: 'open' });
  const b = makeReport({ reportId: 2, status: 'assigned' });
  const c = makeReport({ reportId: 3, status: 'resolved' });

  it('getMyReports and getReportQueue resolve ids to rows in server order', () => {
    const state = rootState(makeServerState({
      reports: makeReportsState({ mine: [2, 1], queue: [3, 2, 1], byId: { 1: a, 2: b, 3: c } }),
    }));
    expect(Selectors.getMyReports(state)).toEqual([b, a]);
    expect(Selectors.getReportQueue(state)).toEqual([c, b, a]);
    expect(Selectors.getMyReportsLoaded(state)).toBe(true);
    expect(Selectors.getReportQueueLoaded(state)).toBe(true);
  });

  it('returns a stable empty list and not-loaded before the first load', () => {
    const state = rootState(makeServerState());
    expect(Selectors.getMyReports(state)).toBe(Selectors.getReportQueue(state));
    expect(Selectors.getMyReports(state)).toEqual([]);
    expect(Selectors.getMyReportsLoaded(state)).toBe(false);
    expect(Selectors.getReportQueueLoaded(state)).toBe(false);
  });

  it.each(['mine', 'queue'] as const)('distinguishes unloaded and successive empty %s responses', (list) => {
    const select = list === 'mine' ? Selectors.getMyReports : Selectors.getReportQueue;
    const reports = makeReportsState();
    const unloaded = select(rootState(makeServerState({ reports })));
    const loaded = { ...reports, [list]: [] };
    const first = select(rootState(makeServerState({ reports: loaded })));
    expect(first).toEqual([]);
    expect(first).not.toBe(unloaded);
    expect(select(rootState(makeServerState({ reports: loaded, banUser: 'x' })))).toBe(first);
    const refreshed = select(rootState(makeServerState({ reports: { ...loaded, [list]: [] } })));
    expect(refreshed).toEqual([]);
    expect(refreshed).not.toBe(first);
  });

  it('memoizes the list across unrelated state changes', () => {
    const reports = makeReportsState({ mine: [1], byId: { 1: a } });
    const first = Selectors.getMyReports(rootState(makeServerState({ reports })));
    const second = Selectors.getMyReports(rootState(makeServerState({ reports, banUser: 'x' })));
    expect(second).toBe(first);
  });

  it('getReportQueueStatusCounts tallies the loaded queue', () => {
    const state = rootState(makeServerState({
      reports: makeReportsState({ queue: [1, 2, 3], byId: { 1: a, 2: b, 3: c } }),
    }));
    expect(Selectors.getReportQueueStatusCounts(state)).toEqual({ open: 1, assigned: 1, resolved: 1, dismissed: 0 });
  });

  it('reads single reports, details, stats, replay and the last notice', () => {
    const stats = create(Response_ReportStatsSchema, { totalReports: 4 });
    const state = rootState(makeServerState({
      reports: makeReportsState({
        queue: [1],
        queueTotalCount: 12,
        byId: { 1: a },
        details: { 1: a },
        stats,
        replay: { gameId: 5, replayId: 6, replayData: new Uint8Array() },
      }),
    }));
    expect(Selectors.getReport(state, 1)).toBe(a);
    expect(Selectors.getReportDetails(state, 1)).toBe(a);
    expect(Selectors.getReportDetails(state, 2)).toBeUndefined();
    expect(Selectors.getReportStats(state)).toBe(stats);
    expect(Selectors.getReportReplay(state)?.gameId).toBe(5);
    expect(Selectors.getReportQueueTotalCount(state)).toBe(12);
    expect(Selectors.getLastReportNotice(state)).toBeNull();
  });

  it('tolerates a preloaded state without the reports field', () => {
    const server: Partial<ServerState> = makeServerState();
    delete server.reports;
    expect(Selectors.getMyReports(rootState(server as ServerState))).toEqual([]);
    expect(Selectors.getReportStats(rootState(server as ServerState))).toBeNull();
  });

  it.each(['mine', 'queue'] as const)('skips absent rows in the %s list while retaining order', (list) => {
    const first = makeReport({ reportId: 1 });
    const last = makeReport({ reportId: 3 });
    const state = rootState(makeServerState({
      reports: makeReportsState({ [list]: [3, 404, 1], byId: { 1: first, 3: last } }),
    }));
    const select = list === 'mine' ? Selectors.getMyReports : Selectors.getReportQueue;
    expect(select(state)).toEqual([last, first]);
    expect(state.server.reports[list]).toEqual([3, 404, 1]);
  });
});
