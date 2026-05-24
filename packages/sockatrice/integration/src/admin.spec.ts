// Admin command pipeline smoke test — validates that sendAdminCommand
// encodes, correlates, and dispatches correctly end-to-end.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { AdminCommands } from '../../src';

import { connectAndLogin, getMockResponse } from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastAdminCommand } from '../../src/testing/command-capture';

describe('admin commands', () => {
  it('adjustMod sends command and dispatches on success', () => {
    connectAndLogin();

    deliverMessage(buildSessionEventMessage(
      Data.Event_UserJoined_ext,
      create(Data.Event_UserJoinedSchema, {
        userInfo: create(Data.ServerInfo_UserSchema, {
          name: 'bob',
          userLevel: Data.ServerInfo_User_UserLevelFlag.IsRegistered,
        }),
      })
    ));
    expect(getMockResponse().session.userJoined).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bob' }),
    );

    AdminCommands.adjustMod('bob', true, false);

    const { cmdId, value } = findLastAdminCommand(Data.Command_AdjustMod_ext);
    expect(value.userName).toBe('bob');
    expect(value.shouldBeMod).toBe(true);
    expect(value.shouldBeJudge).toBe(false);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().admin.adjustMod).toHaveBeenCalledWith('bob', true, false);
  });

  it('shutdownServer sends command and dispatches on success', () => {
    connectAndLogin();

    AdminCommands.shutdownServer('Scheduled maintenance', 10);

    const { cmdId, value } = findLastAdminCommand(Data.Command_ShutdownServer_ext);
    expect(value.reason).toBe('Scheduled maintenance');
    expect(value.minutes).toBe(10);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().admin.shutdownServer).toHaveBeenCalled();
  });

  it('reloadConfig sends command and dispatches on RespOk', () => {
    connectAndLogin();

    AdminCommands.reloadConfig();

    const { cmdId } = findLastAdminCommand(Data.Command_ReloadConfig_ext);
    expect(cmdId).toBeGreaterThan(0);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().admin.reloadConfig).toHaveBeenCalled();
  });

  it('updateServerMessage sends command and dispatches on RespOk', () => {
    connectAndLogin();

    AdminCommands.updateServerMessage();

    const { cmdId } = findLastAdminCommand(Data.Command_UpdateServerMessage_ext);
    expect(cmdId).toBeGreaterThan(0);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().admin.updateServerMessage).toHaveBeenCalled();
  });
});
