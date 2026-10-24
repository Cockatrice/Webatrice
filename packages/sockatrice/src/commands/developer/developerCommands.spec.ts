vi.mock('../../WebClient');

import { create } from '@bufbuild/protobuf';
import { Mock } from 'vitest';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { WebClient } from '../../WebClient';
import { CommandFailure } from '../../types/CommandFailure';
import {
  Command_GetServerStats_ext,
  Command_ViewLogHistory_dev_ext,
  Response_GetServerStats_ext,
  Response_ResponseCode,
  Response_ViewLogHistory_ext,
  ServerInfo_ChatMessageSchema,
} from '../../generated';

import { getServerStats } from './getServerStats';
import { viewLogHistory } from './viewLogHistory';

const { invokeOnSuccess, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendDeveloperCommand as Mock,
  2
);

describe('getServerStats', () => {

  it('calls sendDeveloperCommand with Command_GetServerStats', () => {
    getServerStats();
    expect(WebClient.instance.protobuf.sendDeveloperCommand).toHaveBeenCalledWith(
      Command_GetServerStats_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_GetServerStats_ext })
    );
  });

  it('onSuccess forwards the snapshot to response.developer.serverStats', () => {
    getServerStats();
    const stats = { usersCount: 12n, gamesCount: 3n, commandStats: [] };
    invokeOnSuccess(stats);
    expect(WebClient.instance.response.developer!.serverStats).toHaveBeenCalledWith(stats);
  });

  it('does not forward on RespLoginNeeded (caller lacks the developer bit)', () => {
    getServerStats();
    invokeOnError(Response_ResponseCode.RespLoginNeeded);
    expect(WebClient.instance.response.developer!.serverStats).not.toHaveBeenCalled();
  });

  it('tolerates a consumer without a developer response scope', () => {
    const { developer } = WebClient.instance.response;
    WebClient.instance.response.developer = undefined;
    try {
      getServerStats();
      expect(() => invokeOnSuccess({})).not.toThrow();
    } finally {
      WebClient.instance.response.developer = developer;
    }
  });
});

describe('viewLogHistory (developer family)', () => {

  it('sends the DeveloperCommand-scoped Command_ViewLogHistory extension', () => {
    viewLogHistory({ userName: 'alice', dateRange: 1 });
    expect(WebClient.instance.protobuf.sendDeveloperCommand).toHaveBeenCalledWith(
      Command_ViewLogHistory_dev_ext,
      expect.objectContaining({ userName: 'alice', dateRange: 1 }),
      expect.objectContaining({ responseExt: Response_ViewLogHistory_ext })
    );
  });

  it('routes the log messages into response.moderator.viewLogs like the moderator family', () => {
    viewLogHistory({ userName: 'alice' });
    const logMessage = [create(ServerInfo_ChatMessageSchema, { senderName: 'alice', message: 'hi' })];
    invokeOnSuccess({ logMessage });
    expect(WebClient.instance.response.moderator.viewLogs).toHaveBeenCalledWith(logMessage);
  });

  it('reports a failed search through moderator.commandFailed like the moderator family', () => {
    viewLogHistory({ userName: 'alice' });
    invokeOnError(8, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.moderator.commandFailed).toHaveBeenCalledWith(
      'viewLogHistory', 8, 'alice', CommandFailure.Timeout,
    );
  });

  it('echoes the request id on both outcomes', () => {
    viewLogHistory({ userName: 'alice' }, 'req-1');
    invokeOnSuccess({ logMessage: [] });
    expect(WebClient.instance.response.moderator.viewLogs).toHaveBeenCalledWith([], 'req-1');

    viewLogHistory({ userName: 'alice' }, 'req-2');
    invokeOnError(8, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.moderator.commandFailed).toHaveBeenCalledWith(
      'viewLogHistory', 8, 'alice', CommandFailure.Timeout, 'req-2',
    );
  });
});


it('reports an unfiltered developer log failure with an empty target', () => {
  viewLogHistory({ dateRange: 1 });
  const [ext, cmd] = (WebClient.instance.protobuf.sendDeveloperCommand as Mock).mock.calls[0];
  expect(ext).toBe(Command_ViewLogHistory_dev_ext);
  expect({ ...cmd }).toEqual({ $typeName: cmd.$typeName, dateRange: 1, logLocation: [] });
  invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
  expect(WebClient.instance.response.moderator.commandFailed).toHaveBeenCalledExactlyOnceWith(
    'viewLogHistory', Response_ResponseCode.RespFunctionNotAllowed, '', undefined,
  );
  expect(WebClient.instance.response.moderator.viewLogs).not.toHaveBeenCalled();
});

describe('getServerStats failure', () => {
  it('reports through response.developer.commandFailed so the page can leave its pending state', () => {
    getServerStats();
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.developer!.commandFailed).toHaveBeenCalledWith(
      'getServerStats', Response_ResponseCode.RespNotConnected, '', CommandFailure.Timeout,
    );
  });
});
