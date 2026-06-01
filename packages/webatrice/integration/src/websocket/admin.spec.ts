import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import { Command_AdjustMod_ext, Command_ReloadConfig_ext, Command_ShutdownServer_ext, Command_UpdateServerMessage_ext, Event_UserJoinedSchema, Event_UserJoined_ext, Response_ResponseCode, ServerInfo_UserSchema, ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { store } from '../helpers/setup';
import { AdminCommands } from '@cockatrice/sockatrice';

import { connectAndLogin } from '../helpers/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../helpers/protobuf-builders';
import { findLastAdminCommand } from '../helpers/command-capture';

describe('admin commands', () => {
  it('adjustMod modifies the user level bitflags on success', () => {
    connectAndLogin();

    // Add bob to the user list so the reducer has a target
    deliverMessage(buildSessionEventMessage(
      Event_UserJoined_ext,
      create(Event_UserJoinedSchema, {
        userInfo: create(ServerInfo_UserSchema, {
          name: 'bob',
          userLevel: ServerInfo_User_UserLevelFlag.IsRegistered,
        }),
      })
    ));
    expect(store.getState().server.users.bob).toBeDefined();

    AdminCommands.adjustMod('bob', true, false);

    const { cmdId, value } = findLastAdminCommand(Command_AdjustMod_ext);
    expect(value.userName).toBe('bob');
    expect(value.shouldBeMod).toBe(true);
    expect(value.shouldBeJudge).toBe(false);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));

    const bobLevel = store.getState().server.users.bob.userLevel;
    expect(bobLevel & ServerInfo_User_UserLevelFlag.IsModerator).toBeTruthy();
  });

  it('shutdownServer sends command and dispatches on success', () => {
    connectAndLogin();

    AdminCommands.shutdownServer('Scheduled maintenance', 10);

    const { cmdId, value } = findLastAdminCommand(Command_ShutdownServer_ext);
    expect(value.reason).toBe('Scheduled maintenance');
    expect(value.minutes).toBe(10);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));
  });

  it('reloadConfig sends command and resolves on RespOk', () => {
    connectAndLogin();

    AdminCommands.reloadConfig();

    const { cmdId } = findLastAdminCommand(Command_ReloadConfig_ext);
    expect(cmdId).toBeGreaterThan(0);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));
  });

  it('updateServerMessage sends command and resolves on RespOk', () => {
    connectAndLogin();

    AdminCommands.updateServerMessage();

    const { cmdId } = findLastAdminCommand(Command_UpdateServerMessage_ext);
    expect(cmdId).toBeGreaterThan(0);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Response_ResponseCode.RespOk,
    })));
  });
});
