
import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import {
  Command_ReplayDownloadByGameId_ext,
  Command_ReportAddComment_ext,
  Command_ReportAssign_ext,
  Command_ReportDetails_ext,
  Command_ReportList_ext,
  Command_ReportMyList_ext,
  Command_ReportResolve_ext,
  Command_Report_ext,
  Event_NotifyUserSchema,
  Event_NotifyUser_NotificationType,
  Event_NotifyUser_ext,
  Response_ReplayDownloadByGameIdSchema,
  Response_ReplayDownloadByGameId_ext,
  Response_ReportDetailsSchema,
  Response_ReportDetails_ext,
  Response_ReportListSchema,
  Response_ReportList_ext,
  Response_ReportMyListSchema,
  Response_ReportMyList_ext,
  Response_ResponseCode,
  ServerInfo_ReportCommentSchema,
  ServerInfo_ReportSchema,
} from '@cockatrice/sockatrice/generated';
import { ModeratorCommands, SessionCommands } from '@cockatrice/sockatrice';
import { server } from '@cockatrice/datatrice';

import { connectAndLogin, store } from '../helpers/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../helpers/protobuf-builders';
import { findLastModeratorCommand, findLastSessionCommand } from '../helpers/command-capture';

function lastAction() {
  return (store.getState() as unknown as { action: { type: string; payload: unknown } }).action;
}

function answer(cmdId: number, responseCode: Response_ResponseCode) {
  deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
}

describe('report commands', () => {
  it('report sends every field and reports success to the caller', () => {
    connectAndLogin();
    const onSubmitted = vi.fn();
    const onFailure = vi.fn();

    SessionCommands.report(
      { reportedUser: 'mallory', category: 'harassment', description: 'insults', gameId: 12, chatLog: '[10:00:00] mallory: x' },
      onSubmitted,
      onFailure,
    );

    const { cmdId, value } = findLastSessionCommand(Command_Report_ext);
    expect(value).toMatchObject({
      reportedUser: 'mallory', category: 'harassment', description: 'insults', gameId: 12, chatLog: '[10:00:00] mallory: x',
    });
    answer(cmdId, Response_ResponseCode.RespOk);
    expect(onSubmitted).toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('report passes the daily-limit code to the caller', () => {
    connectAndLogin();
    const onFailure = vi.fn();
    SessionCommands.report({ reportedUser: 'mallory', category: 'spam', description: 'x' }, undefined, onFailure);
    answer(findLastSessionCommand(Command_Report_ext).cmdId, Response_ResponseCode.RespTooManyRequests);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespTooManyRequests, expect.anything());
  });

  it('reportMyList and reportDetails land in server.reports', () => {
    connectAndLogin();

    SessionCommands.reportMyList();
    const list = findLastSessionCommand(Command_ReportMyList_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: list.cmdId,
      responseCode: Response_ResponseCode.RespOk,
      ext: Response_ReportMyList_ext,
      value: create(Response_ReportMyListSchema, {
        reports: [create(ServerInfo_ReportSchema, { reportId: 7, reportedUserName: 'mallory', status: 'open' })],
      }),
    })));
    expect(store.getState().server.reports.mine).toEqual([7]);

    SessionCommands.reportDetails(7);
    const details = findLastSessionCommand(Command_ReportDetails_ext);
    expect(details.value.reportId).toBe(7);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: details.cmdId,
      responseCode: Response_ResponseCode.RespOk,
      ext: Response_ReportDetails_ext,
      value: create(Response_ReportDetailsSchema, {
        report: create(ServerInfo_ReportSchema, {
          reportId: 7,
          status: 'open',
          chatLog: 'log',
          comments: [create(ServerInfo_ReportCommentSchema, { authorName: 'modA', commentText: 'Looking', isModerator: true })],
        }),
      }),
    })));
    expect(store.getState().server.reports.details[7].comments[0].commentText).toBe('Looking');
  });

  it('a refused report detail raises the session failure signal for that report', () => {
    connectAndLogin();
    SessionCommands.reportDetails(8);
    answer(findLastSessionCommand(Command_ReportDetails_ext).cmdId, Response_ResponseCode.RespAccessDenied);
    expect(lastAction()).toMatchObject(server.Actions.sessionCommandFailed({
      command: 'reportDetails', responseCode: Response_ResponseCode.RespAccessDenied, target: '8', failure: undefined,
    }));
  });

  it('reportAddComment sends the comment and reports RespInvalidData on a closed report', () => {
    connectAndLogin();
    const onFailure = vi.fn();
    SessionCommands.reportAddComment(7, 'more', undefined, onFailure);
    const { cmdId, value } = findLastSessionCommand(Command_ReportAddComment_ext);
    expect(value).toMatchObject({ reportId: 7, comment: 'more' });
    answer(cmdId, Response_ResponseCode.RespInvalidData);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespInvalidData, expect.anything());
  });

  it('a REPORT_RESOLVED session event raises the report notice', () => {
    connectAndLogin();
    deliverMessage(buildSessionEventMessage(Event_NotifyUser_ext, create(Event_NotifyUserSchema, {
      type: Event_NotifyUser_NotificationType.REPORT_RESOLVED,
      customTitle: 'Report Resolved',
      customContent: 'Your report about mallory has been resolved.',
    })));
    const notice = store.getState().server.reports.lastNotice;
    expect(notice?.notification.customTitle).toBe('Report Resolved');
    expect(store.getState().server.notifications).toHaveLength(1);
  });
});

describe('moderation queue commands', () => {
  function loadQueue() {
    ModeratorCommands.reportList(true);
    const { cmdId, value } = findLastModeratorCommand(Command_ReportList_ext);
    expect(value.unresolvedOnly).toBe(true);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Response_ResponseCode.RespOk,
      ext: Response_ReportList_ext,
      value: create(Response_ReportListSchema, {
        reports: [create(ServerInfo_ReportSchema, { reportId: 3, status: 'open', reportedUserName: 'mallory' })],
        totalCount: 1,
      }),
    })));
  }

  it('lists, assigns and resolves, updating the stored row each time', () => {
    connectAndLogin('modA');
    loadQueue();
    expect(store.getState().server.reports.queue).toEqual([3]);

    ModeratorCommands.reportAssign(3);
    answer(findLastModeratorCommand(Command_ReportAssign_ext).cmdId, Response_ResponseCode.RespOk);
    expect(lastAction()).toMatchObject(server.Actions.reportAssigned({ reportId: 3 }));
    expect(store.getState().server.reports.byId[3]).toMatchObject({ status: 'assigned', assignedModName: 'modA' });

    ModeratorCommands.reportResolve(3, 'warned', false);
    const resolve = findLastModeratorCommand(Command_ReportResolve_ext);
    expect(resolve.value).toMatchObject({ reportId: 3, resolutionNote: 'warned', dismissed: false });
    answer(resolve.cmdId, Response_ResponseCode.RespOk);
    expect(store.getState().server.reports.byId[3].status).toBe('resolved');
  });

  it('a lost assignment race leaves the row alone and raises the moderator failure signal', () => {
    connectAndLogin('modA');
    loadQueue();
    ModeratorCommands.reportAssign(3);
    answer(findLastModeratorCommand(Command_ReportAssign_ext).cmdId, Response_ResponseCode.RespInvalidData);
    expect(lastAction()).toMatchObject(server.Actions.moderatorCommandFailed({
      command: 'reportAssign', responseCode: Response_ResponseCode.RespInvalidData, target: '3', failure: undefined,
    }));
    expect(store.getState().server.reports.byId[3].status).toBe('open');
  });

  it('a second replay download of the same game drops the stored replay until it is answered', () => {
    connectAndLogin('modA');
    ModeratorCommands.replayDownloadByGameId(30);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: findLastModeratorCommand(Command_ReplayDownloadByGameId_ext).cmdId,
      responseCode: Response_ResponseCode.RespOk,
      ext: Response_ReplayDownloadByGameId_ext,
      value: create(Response_ReplayDownloadByGameIdSchema, { replayId: 9, replayData: new Uint8Array([1]) }),
    })));
    expect(store.getState().server.reports.replay?.gameId).toBe(30);

    ModeratorCommands.replayDownloadByGameId(30);
    expect(store.getState().server.reports.replay).toBeNull();
    answer(findLastModeratorCommand(Command_ReplayDownloadByGameId_ext).cmdId, Response_ResponseCode.RespNameNotFound);
    expect(lastAction()).toMatchObject(server.Actions.moderatorCommandFailed({
      command: 'replayDownloadByGameId', responseCode: Response_ResponseCode.RespNameNotFound, target: '30', failure: undefined,
    }));
    expect(store.getState().server.reports.replay).toBeNull();
  });
});
