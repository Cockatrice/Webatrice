vi.mock('../WebClient');

import { create } from '@bufbuild/protobuf';
import type { Mock } from 'vitest';
import { WebClient } from '../WebClient';
import {
  Response_ReplayDownloadByGameIdSchema, Response_ReportStatsSchema, Response_ReportUserInfoSchema, ServerInfo_ReportSchema,
} from '../generated';
import { makeCallbackHelpers } from '../testing/callback-helpers';
import { CommandFailure } from '../types/CommandFailure';
import { reportDetails } from './session/reportDetails';
import { reportMyList } from './session/reportMyList';
import { reportList } from './moderator/reportList';
import { reportStats } from './moderator/reportStats';
import { reportAssign } from './moderator/reportAssign';
import { reportResolve } from './moderator/reportResolve';
import { reportUserInfo } from './moderator/reportUserInfo';
import { replayDownloadByGameId } from './moderator/replayDownloadByGameId';

const report = create(ServerInfo_ReportSchema, { reportId: 4 });
const stats = create(Response_ReportStatsSchema);
const info = create(Response_ReportUserInfoSchema, { userName: 'alice' });
const replay = create(Response_ReplayDownloadByGameIdSchema, { replayId: 8, replayData: new Uint8Array([1]) });
const cases = [
  { command: 'reportMyList', scope: 'session', target: '',
    send: (...id: [requestId?: string]) => reportMyList(...id), response: { reports: [report] }, args: [[report]],
    success: () => WebClient.instance.response.session.reportMyList },
  { command: 'reportDetails', scope: 'session', target: '4',
    send: (...id: [requestId?: string]) => reportDetails(4, ...id), response: { report }, args: [report],
    success: () => WebClient.instance.response.session.reportDetails },
  { command: 'reportList', scope: 'moderator', target: '',
    send: (...id: [requestId?: string]) => reportList(true, undefined, undefined, ...id),
    response: { reports: [report], totalCount: 1 }, args: [[report], 1], success: () => WebClient.instance.response.moderator.reportList },
  { command: 'reportStats', scope: 'moderator', target: '',
    send: (...id: [requestId?: string]) => reportStats(...id), response: stats, args: [stats],
    success: () => WebClient.instance.response.moderator.reportStats },
  { command: 'reportAssign', scope: 'moderator', target: '4',
    send: (...id: [requestId?: string]) => reportAssign(4, ...id), response: {}, args: [4],
    success: () => WebClient.instance.response.moderator.reportAssigned },
  { command: 'reportResolve', scope: 'moderator', target: '4',
    send: (...id: [requestId?: string]) => reportResolve(4, 'note', true, ...id), response: {}, args: [4, true],
    success: () => WebClient.instance.response.moderator.reportResolved },
  { command: 'reportUserInfo', scope: 'moderator', target: 'alice',
    send: (...id: [requestId?: string]) => reportUserInfo('alice', ...id), response: info, args: [info],
    success: () => WebClient.instance.response.moderator.reportUserInfo },
  { command: 'replayDownloadByGameId', scope: 'moderator', target: '77',
    send: (...id: [requestId?: string]) => replayDownloadByGameId(77, ...id), response: replay, args: [77, replay],
    success: () => WebClient.instance.response.moderator.replayDownloadedByGameId },
] as const;

describe.each(cases)('$command request identity', ({ command, scope, target, send, response, args, success }) => {
  const mockSend = (scope === 'session'
    ? WebClient.instance.protobuf.sendSessionCommand : WebClient.instance.protobuf.sendModeratorCommand) as Mock;
  const { getLastSendOpts } = makeCallbackHelpers(mockSend);

  it('echoes each caller identity when an older view replies before the current view', () => {
    send('left-view');
    const first = getLastSendOpts();
    const firstWire = mockSend.mock.lastCall?.[1];
    send('current-view');
    const second = getLastSendOpts();
    expect(mockSend.mock.lastCall?.[1]).toEqual(firstWire);
    expect(firstWire).not.toHaveProperty('requestId');
    first.onSuccess(response);
    second.onSuccess(response);
    expect(success()).toHaveBeenNthCalledWith(1, ...args, 'left-view');
    expect(success()).toHaveBeenNthCalledWith(2, ...args, 'current-view');
  });

  it.each([undefined, CommandFailure.Timeout, CommandFailure.Disconnected, CommandFailure.NotSent])(
    'echoes the older caller identity on failure %s while another request is pending', (failure) => {
      send('left-view');
      const first = getLastSendOpts();
      send('current-view');
      first.onError(7, {}, failure);
      expect(WebClient.instance.response[scope].commandFailed).toHaveBeenCalledWith(command, 7, target, failure, 'left-view');
      expect(success()).not.toHaveBeenCalled();
      getLastSendOpts().onSuccess(response);
      expect(success()).toHaveBeenCalledWith(...args, 'current-view');
    },
  );

  it('preserves success and failure callback arity for callers without an identity', () => {
    send();
    getLastSendOpts().onSuccess(response);
    expect(success()).toHaveBeenCalledWith(...args);
    getLastSendOpts().onError(7, {}, undefined);
    expect(WebClient.instance.response[scope].commandFailed).toHaveBeenCalledWith(command, 7, target, undefined);
  });
});
