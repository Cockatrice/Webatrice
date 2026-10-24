import { createSelector } from '@reduxjs/toolkit';
import type { ServerInfo_Report } from '@cockatrice/sockatrice/generated';

import { ServerState, ServerStateReports } from './server.interfaces';
import { initialReportsState } from './server.reducer.reports';
import { countReportStatuses, ReportStatusCounts } from './server.reports';

type State = { server: ServerState };

const EMPTY_REPORTS: ServerInfo_Report[] = [];

const selectReports = ({ server }: State): ServerStateReports => server.reports ?? initialReportsState;
const selectById = (state: State) => selectReports(state).byId;

function rowsFor(ids: number[] | null, byId: ServerStateReports['byId']): ServerInfo_Report[] {
  if (!ids) {
    return EMPTY_REPORTS;
  }
  const rows: ServerInfo_Report[] = [];
  for (const id of ids) {
    const row = byId[id];
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

const getReportQueue = createSelector(
  [(state: State) => selectReports(state).queue, selectById],
  rowsFor,
);

export const reportSelectors = {
  getMyReports: createSelector([(state: State) => selectReports(state).mine, selectById], rowsFor),
  getMyReportsLoaded: (state: State): boolean => selectReports(state).mine !== null,

  getReportQueue,
  getReportQueueLoaded: (state: State): boolean => selectReports(state).queue !== null,
  getReportQueueTotalCount: (state: State): number => selectReports(state).queueTotalCount,
  getReportQueueStatusCounts: createSelector(
    [getReportQueue],
    (rows): ReportStatusCounts => countReportStatuses(rows),
  ),

  getReport: (state: State, reportId: number): ServerInfo_Report | undefined => selectById(state)[reportId],
  getReportDetails: (state: State, reportId: number): ServerInfo_Report | undefined =>
    selectReports(state).details[reportId],
  getReportStats: (state: State) => selectReports(state).stats,
  getReportReplay: (state: State) => selectReports(state).replay,
  getLastReportNotice: (state: State) => selectReports(state).lastNotice,
};
