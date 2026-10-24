import { create } from '@bufbuild/protobuf';
import type { Store } from '@reduxjs/toolkit';
import {
  Response_ReplayDownloadByGameIdSchema, Response_ReportStatsSchema, Response_ReportUserInfoSchema, ServerInfo_ReportSchema,
} from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { ModeratorResponseImpl } from './ModeratorResponseImpl';
import { SessionResponseImpl } from './SessionResponseImpl';
import { Actions } from '../store/server/server.actions';
import { serverReducer } from '../store/server/server.reducer';

function setup() {
  let state = serverReducer(undefined, Actions.userInvestigationStarted({ userName: 'alice' }));
  const dispatch = vi.fn();
  const store = { dispatch, getState: () => ({ server: state }) } as unknown as Store;
  return {
    dispatch, moderator: new ModeratorResponseImpl(store), session: new SessionResponseImpl(store),
    endInvestigation: () => {
      state = serverReducer(state, Actions.userInvestigationStarted({ userName: 'bob' }));
    },
    state,
  };
}

it.each([
  'reportMyList', 'reportDetails', 'reportList', 'reportAssigned', 'reportResolved',
  'reportStats', 'userInfoReport', 'reportReplayDownloaded',
] as const)('%s carries each caller identity without changing stored report data', (name) => {
  const { dispatch, moderator, session, state } = setup();
  const report = create(ServerInfo_ReportSchema, { reportId: 4 });
  const stats = create(Response_ReportStatsSchema);
  const info = create(Response_ReportUserInfoSchema, { userName: 'alice' });
  const replay = create(Response_ReplayDownloadByGameIdSchema, { replayId: 8, replayData: new Uint8Array([1]) });
  const checks = {
    reportMyList: { send: (id: string) => session.reportMyList([report], id), action: Actions.reportMyList({ reports: [report] }) },
    reportDetails: { send: (id: string) => session.reportDetails(report, id), action: Actions.reportDetails({ report }) },
    reportList: { send: (id: string) => moderator.reportList([report], 1, id),
      action: Actions.reportList({ reports: [report], totalCount: 1 }) },
    reportAssigned: { send: (id: string) => moderator.reportAssigned(4, id), action: Actions.reportAssigned({ reportId: 4 }) },
    reportResolved: { send: (id: string) => moderator.reportResolved(4, true, id),
      action: Actions.reportResolved({ reportId: 4, dismissed: true }) },
    reportStats: { send: (id: string) => moderator.reportStats(stats, id), action: Actions.reportStats({ stats }) },
    userInfoReport: { send: (id: string) => moderator.reportUserInfo(info, id), action: Actions.userInfoReport({ info }) },
    reportReplayDownloaded: { send: (id: string) => moderator.replayDownloadedByGameId(77, replay, id),
      action: Actions.reportReplayDownloaded({ gameId: 77, replayId: 8, replayData: replay.replayData }) },
  };
  const { send, action } = checks[name];
  const before = serverReducer(state, Actions.reportList({ reports: [report], totalCount: 1 }));
  for (const requestId of ['left-view', 'current-view']) {
    send(requestId);
    const correlated = { ...action, payload: { ...action.payload, requestId } };
    expect(dispatch).toHaveBeenLastCalledWith(correlated);
    expect(serverReducer(before, correlated)).toEqual(serverReducer(before, action));
  }
});

it('keeps the existing privacy guard before dispatching a user-info outcome', () => {
  const { dispatch, moderator, endInvestigation } = setup();
  endInvestigation();
  moderator.reportUserInfo(create(Response_ReportUserInfoSchema, { userName: 'alice', adminNotes: 'private' }), 'left-view');
  expect(dispatch).not.toHaveBeenCalled();
});

it.each([undefined, ...Object.values(WebsocketTypes.CommandFailure)])('preserves report failure identity for %s', (failure) => {
  const { dispatch, moderator, session } = setup();
  for (const command of ['reportMyList', 'reportDetails'] as const) {
    session.commandFailed(command, 7, '4', failure, 'left-view');
    expect(dispatch).toHaveBeenLastCalledWith(Actions.sessionCommandFailed({
      command, responseCode: 7, target: '4', failure, requestId: 'left-view',
    }));
  }
  const moderatorCommands = [
    'reportList', 'reportStats', 'reportAssign', 'reportResolve', 'reportUserInfo', 'replayDownloadByGameId',
  ] as const;
  for (const command of moderatorCommands) {
    moderator.commandFailed(command, 7, '4', failure, 'left-view');
    expect(dispatch).toHaveBeenLastCalledWith(Actions.moderatorCommandFailed({
      command, responseCode: 7, target: '4', failure, requestId: 'left-view',
    }));
  }
});
