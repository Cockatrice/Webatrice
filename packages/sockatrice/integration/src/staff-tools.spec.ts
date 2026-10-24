
import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import * as Data from '../../src/generated';
import { AdminCommands, DeveloperCommands, ModeratorCommands } from '../../src';

import { connectAndLogin, getMockResponse } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import {
  findLastAdminCommand,
  findLastDeveloperCommand,
  findLastModeratorCommand,
} from '../../src/testing/command-capture';

const answer = (cmdId: bigint | number, responseCode: Data.Response_ResponseCode) =>
  deliverMessage(buildResponseMessage(buildResponse({ cmdId: Number(cmdId), responseCode })));

describe('administration round trips', () => {
  it('reports a refused server command through admin.commandFailed', () => {
    connectAndLogin();

    AdminCommands.reloadConfig();
    answer(findLastAdminCommand(Data.Command_ReloadConfig_ext).cmdId, Data.Response_ResponseCode.RespFunctionNotAllowed);

    expect(getMockResponse().admin.commandFailed).toHaveBeenCalledWith(
      'reloadConfig', Data.Response_ResponseCode.RespFunctionNotAllowed, '', undefined,
    );
    expect(getMockResponse().admin.reloadConfig).not.toHaveBeenCalled();
  });
});

describe('moderation round trips', () => {
  it('getUserAlts forwards the alts keyed by the investigated user', () => {
    connectAndLogin();

    ModeratorCommands.getUserAlts('alice');
    const { cmdId } = findLastModeratorCommand(Data.Command_GetUserAlts_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_UserAlts_ext,
      value: create(Data.Response_UserAltsSchema, {
        alts: [create(Data.ServerInfo_UserAltSchema, { userName: 'alice', clientid: 'c1' })],
      }),
    })));

    expect(getMockResponse().moderator.userAlts).toHaveBeenCalledWith('alice', [expect.objectContaining({ clientid: 'c1' })]);
  });

  it('reportUserInfo and getUserSessions report a failure with the user as target', () => {
    connectAndLogin();

    ModeratorCommands.reportUserInfo('ghost');
    answer(findLastModeratorCommand(Data.Command_ReportUserInfo_ext).cmdId, Data.Response_ResponseCode.RespNameNotFound);
    ModeratorCommands.getUserSessions('ghost');
    answer(findLastModeratorCommand(Data.Command_GetUserSessions_ext).cmdId, Data.Response_ResponseCode.RespInternalError);

    const { commandFailed, reportUserInfo } = getMockResponse().moderator;
    expect(commandFailed).toHaveBeenCalledWith('reportUserInfo', Data.Response_ResponseCode.RespNameNotFound, 'ghost', undefined);
    expect(commandFailed).toHaveBeenCalledWith('getUserSessions', Data.Response_ResponseCode.RespInternalError, 'ghost', undefined);
    expect(reportUserInfo).not.toHaveBeenCalled();
  });

  it('resetUserPassword hands the temporary password only to the caller', () => {
    connectAndLogin();
    const onReset = vi.fn();

    AdminCommands.resetUserPassword('alice', onReset);
    const { cmdId } = findLastAdminCommand(Data.Command_ResetUserPassword_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ResetUserPassword_ext,
      value: create(Data.Response_ResetUserPasswordSchema, { userName: 'alice', temporaryPassword: 'tmp-123' }),
    })));

    expect(onReset).toHaveBeenCalledWith('alice', 'tmp-123');
  });

  it('getServerStats reports a refusal through developer.commandFailed', () => {
    connectAndLogin();

    DeveloperCommands.getServerStats();
    answer(findLastDeveloperCommand(Data.Command_GetServerStats_ext).cmdId, Data.Response_ResponseCode.RespFunctionNotAllowed);

    expect(getMockResponse().developer.commandFailed).toHaveBeenCalledWith(
      'getServerStats', Data.Response_ResponseCode.RespFunctionNotAllowed, '', undefined,
    );
  });
});
