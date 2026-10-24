import { create } from '@bufbuild/protobuf';
import { vi } from 'vitest';
import * as Data from '../../src/generated';
import { ModeratorCommands, SessionCommands } from '../../src';
import { CommandFailure } from '../../src/types/CommandFailure';
import { connectAndLogin, getMockResponse, getMockWebSocket, getWebClient } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { findLastModeratorCommand, findLastSessionCommand } from '../../src/testing/command-capture';

const report = create(Data.ServerInfo_ReportSchema, { reportId: 4, status: 'open', description: 'spam' });
const stats = create(Data.Response_ReportStatsSchema, { totalReports: 17 });
const info = create(Data.Response_ReportUserInfoSchema, { userName: 'alice', totalReports: 3 });
const replay = create(Data.Response_ReplayDownloadByGameIdSchema, { replayId: 8, replayData: new Uint8Array([1, 2]) });
const cases = [
  { name: 'reportMyList', scope: 'session', target: '',
    label: 'reportMyList',
    send: (...id: [requestId?: string]) => SessionCommands.reportMyList(...id),
    capture: () => findLastSessionCommand(Data.Command_ReportMyList_ext),
    fields: {},
    answer: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ReportMyList_ext, value: create(Data.Response_ReportMyListSchema, { reports: [report] }),
    }),
    callback: () => getMockResponse().session.reportMyList!, args: [[report]] },
  { name: 'reportDetails', scope: 'session', target: '4',
    label: 'reportDetails',
    send: (...id: [requestId?: string]) => SessionCommands.reportDetails(4, ...id),
    capture: () => findLastSessionCommand(Data.Command_ReportDetails_ext),
    fields: { reportId: 4 },
    answer: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ReportDetails_ext, value: create(Data.Response_ReportDetailsSchema, { report }),
    }),
    callback: () => getMockResponse().session.reportDetails!, args: [report] },
  { name: 'reportList', scope: 'moderator', target: '',
    label: 'reportList',
    send: (...id: [requestId?: string]) => ModeratorCommands.reportList(true, 20, 5, ...id),
    capture: () => findLastModeratorCommand(Data.Command_ReportList_ext),
    fields: { unresolvedOnly: true, offset: 20, limit: 5 },
    answer: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ReportList_ext, value: create(Data.Response_ReportListSchema, { reports: [report], totalCount: 17 }),
    }),
    callback: () => getMockResponse().moderator.reportList!, args: [[report], 17] },
  { name: 'reportStats', scope: 'moderator', target: '',
    label: 'reportStats',
    send: (...id: [requestId?: string]) => ModeratorCommands.reportStats(...id),
    capture: () => findLastModeratorCommand(Data.Command_ReportStats_ext),
    fields: {},
    answer: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ReportStats_ext, value: create(Data.Response_ReportStatsSchema, stats),
    }),
    callback: () => getMockResponse().moderator.reportStats!, args: [stats] },
  { name: 'reportAssign', scope: 'moderator', target: '4',
    label: 'reportAssign',
    send: (...id: [requestId?: string]) => ModeratorCommands.reportAssign(4, ...id),
    capture: () => findLastModeratorCommand(Data.Command_ReportAssign_ext),
    fields: { reportId: 4 },
    answer: (cmdId: number) => buildResponse({ cmdId }),
    callback: () => getMockResponse().moderator.reportAssigned!, args: [4] },
  { name: 'reportResolve', scope: 'moderator', target: '4',
    label: 'reportResolve explicit dismissal',
    send: (...id: [requestId?: string]) => ModeratorCommands.reportResolve(4, 'reviewed', true, ...id),
    capture: () => findLastModeratorCommand(Data.Command_ReportResolve_ext),
    fields: { reportId: 4, resolutionNote: 'reviewed', dismissed: true },
    answer: (cmdId: number) => buildResponse({ cmdId }),
    callback: () => getMockResponse().moderator.reportResolved!, args: [4, true] },
  { name: 'reportResolve', scope: 'moderator', target: '4',
    label: 'reportResolve defaults',
    send: (...id: [requestId?: string]) => ModeratorCommands.reportResolve(4, undefined, undefined, ...id),
    capture: () => findLastModeratorCommand(Data.Command_ReportResolve_ext),
    fields: { reportId: 4, dismissed: false },
    answer: (cmdId: number) => buildResponse({ cmdId }),
    callback: () => getMockResponse().moderator.reportResolved!, args: [4, false] },
  { name: 'reportUserInfo', scope: 'moderator', target: 'alice',
    label: 'reportUserInfo',
    send: (...id: [requestId?: string]) => ModeratorCommands.reportUserInfo('alice', ...id),
    capture: () => findLastModeratorCommand(Data.Command_ReportUserInfo_ext),
    fields: { userName: 'alice' },
    answer: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ReportUserInfo_ext, value: create(Data.Response_ReportUserInfoSchema, info),
    }),
    callback: () => getMockResponse().moderator.reportUserInfo!, args: [info] },
  { name: 'replayDownloadByGameId', scope: 'moderator', target: '77',
    label: 'replayDownloadByGameId',
    send: (...id: [requestId?: string]) => ModeratorCommands.replayDownloadByGameId(77, ...id),
    capture: () => findLastModeratorCommand(Data.Command_ReplayDownloadByGameId_ext),
    fields: { gameId: 77 },
    answer: (cmdId: number) => buildResponse({
      cmdId, ext: Data.Response_ReplayDownloadByGameId_ext, value: create(Data.Response_ReplayDownloadByGameIdSchema, replay),
    }),
    callback: () => getMockResponse().moderator.replayDownloadedByGameId!, args: [77, replay] },
] as const;

describe.each(cases)('$label report round trip', ({ name, scope, target, send, capture, fields, answer, callback, args }) => {
  it.each([[], ['view-14']] as [requestId?: string][])('delivers the exact success with correlation %j', (...id) => {
    connectAndLogin();
    const socket = getMockWebSocket();
    socket.send.mockClear();
    send(...id);
    const { cmdId, value } = capture();
    expect(socket.send.mock.calls).toHaveLength(1);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, ...fields });
    expect(vi.mocked(callback()).mock.calls).toEqual([]);
    if (name === 'replayDownloadByGameId') {
      expect(vi.mocked(getMockResponse().moderator.replayDownloadByGameIdPending!).mock.calls).toEqual([[77]]);
    }
    deliverMessage(buildResponseMessage(answer(cmdId)));
    expect(vi.mocked(callback()).mock.calls).toEqual([[...args, ...id]]);
    expect(vi.mocked(getMockResponse()[scope].commandFailed!).mock.calls).toEqual([]);
    expect(socket.send.mock.calls).toHaveLength(1);
  });

  it('delivers a rejection with and without caller identity', () => {
    const responseCode = Data.Response_ResponseCode.RespAccessDenied;
    connectAndLogin();
    getMockWebSocket().send.mockClear();
    for (const id of [[], ['view-14']] as [requestId?: string][]) {
      send(...id);
      const { cmdId, value } = capture();
      expect({ ...value }).toEqual({ $typeName: value.$typeName, ...fields });
      deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode })));
    }
    expect(getMockWebSocket().send.mock.calls).toHaveLength(2);
    expect(vi.mocked(getMockResponse()[scope].commandFailed!).mock.calls).toEqual([
      [name, responseCode, target, undefined],
      [name, responseCode, target, undefined, 'view-14'],
    ]);
    expect(vi.mocked(callback()).mock.calls).toEqual([]);
  });

  it('retains identity when a pending request is disconnected', () => {
    connectAndLogin();
    getMockWebSocket().send.mockClear();
    send('view-14');
    const { value } = capture();
    expect({ ...value }).toEqual({ $typeName: value.$typeName, ...fields });
    expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
    getWebClient().disconnect();
    expect(vi.mocked(getMockResponse()[scope].commandFailed!).mock.calls).toEqual([
      [name, -1, target, CommandFailure.Disconnected, 'view-14'],
    ]);
    expect(vi.mocked(callback()).mock.calls).toEqual([]);
  });
});

describe('report details outcomes', () => {
  it('ignores a successful report-details response without a report', () => {
    connectAndLogin();
    getMockWebSocket().send.mockClear();
    SessionCommands.reportDetails(4, 'empty-report');
    const { cmdId, value } = findLastSessionCommand(Data.Command_ReportDetails_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName, reportId: 4 });
    const consoleError = vi.spyOn(console, 'error');
    try {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId, ext: Data.Response_ReportDetails_ext, value: create(Data.Response_ReportDetailsSchema),
      })));
      expect(getMockWebSocket().send.mock.calls).toHaveLength(1);
      expect(vi.mocked(getMockResponse().session.reportDetails!).mock.calls).toEqual([]);
      expect(vi.mocked(getMockResponse().session.commandFailed!).mock.calls).toEqual([]);
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});
