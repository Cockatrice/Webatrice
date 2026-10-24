import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import {
  Event_NotifyUser,
  Response_ReportStats,
  ServerInfo_Report,
  ServerInfo_ReportSchema,
} from '@cockatrice/sockatrice/generated';
import { cloneWith } from '../../common';
import { ServerState, ServerStateReports } from './server.interfaces';
import { ReportStatus } from './server.reports';

export const initialReportsState: ServerStateReports = {
  mine: null,
  queue: null,
  queueTotalCount: 0,
  byId: {},
  details: {},
  stats: null,
  replay: null,
  lastNotice: null,
};

function pruneRows(reports: ServerStateReports): void {
  const keep = new Set<number>([...(reports.mine ?? []), ...(reports.queue ?? [])]);
  for (const id of Object.keys(reports.byId)) {
    if (!keep.has(Number(id))) {
      delete reports.byId[Number(id)];
    }
  }
}

function storeRows(reports: ServerStateReports, rows: ServerInfo_Report[]): number[] {
  const ids: number[] = [];
  for (const row of rows) {
    reports.byId[row.reportId] = row;
    ids.push(row.reportId);
  }
  return ids;
}

function patchReport(reports: ServerStateReports, reportId: number, patch: Partial<ServerInfo_Report>): void {
  const row = reports.byId[reportId];
  if (row) {
    reports.byId[reportId] = cloneWith(ServerInfo_ReportSchema, row, patch);
  }
  const detail = reports.details[reportId];
  if (detail) {
    reports.details[reportId] = cloneWith(ServerInfo_ReportSchema, detail, patch);
  }
}

export const reportReducers = {
  reportMyList: ((state, action) => {
    state.reports.mine = storeRows(state.reports, action.payload.reports);
    pruneRows(state.reports);
  }) as CaseReducer<ServerState, PayloadAction<{ reports: ServerInfo_Report[]; requestId?: string }>>,

  reportList: ((state, action) => {
    state.reports.queue = storeRows(state.reports, action.payload.reports);
    state.reports.queueTotalCount = action.payload.totalCount;
    pruneRows(state.reports);
  }) as CaseReducer<ServerState, PayloadAction<{ reports: ServerInfo_Report[]; totalCount: number; requestId?: string }>>,

  reportDetails: ((state, action) => {
    const { report } = action.payload;
    state.reports.details[report.reportId] = report;
    if (state.reports.byId[report.reportId]) {
      state.reports.byId[report.reportId] = report;
    }
  }) as CaseReducer<ServerState, PayloadAction<{ report: ServerInfo_Report; requestId?: string }>>,

  reportAssigned: ((state, action) => {
    patchReport(state.reports, action.payload.reportId, {
      status: ReportStatus.ASSIGNED,
      assignedModName: state.user?.name ?? '',
    });
  }) as CaseReducer<ServerState, PayloadAction<{ reportId: number; requestId?: string }>>,

  reportResolved: ((state, action) => {
    const { reportId, dismissed } = action.payload;
    patchReport(state.reports, reportId, { status: dismissed ? ReportStatus.DISMISSED : ReportStatus.RESOLVED });
  }) as CaseReducer<ServerState, PayloadAction<{ reportId: number; dismissed: boolean; requestId?: string }>>,

  reportStats: ((state, action) => {
    state.reports.stats = action.payload.stats;
  }) as CaseReducer<ServerState, PayloadAction<{ stats: Response_ReportStats; requestId?: string }>>,

  reportReplayRequested: ((state) => {
    state.reports.replay = null;
  }) as CaseReducer<ServerState>,

  reportReplayDownloaded: ((state, action) => {
    const { gameId, replayId, replayData } = action.payload;
    state.reports.replay = { gameId, replayId, replayData };
  }) as CaseReducer<ServerState, PayloadAction<{ gameId: number; replayId: number; replayData: Uint8Array; requestId?: string }>>,

  reportNotified: ((state, action) => {
    state.reports.lastNotice = { notification: action.payload.notification };
  }) as CaseReducer<ServerState, PayloadAction<{ notification: Event_NotifyUser }>>,
};
