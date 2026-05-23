// Moderator command pipeline smoke tests — validates that sendModeratorCommand
// encodes, correlates, and dispatches correctly end-to-end. One test per
// distinct response pattern (simple vs. extension-payload).

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { ModeratorCommands } from '../../src';

import { connectAndLogin, getMockResponse } from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastModeratorCommand } from '../../src/testing/command-capture';

describe('moderator commands', () => {
  it('getBanHistory dispatches banHistory on success', () => {
    connectAndLogin();

    ModeratorCommands.getBanHistory('baduser');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_GetBanHistory_ext);
    expect(value.userName).toBe('baduser');

    const banEntry = create(Data.ServerInfo_BanSchema, {
      adminId: 'admin1',
      adminName: 'Admin',
      banTime: '2026-01-01',
      banLength: '60',
      visibleReason: 'spamming',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_BanHistory_ext,
      value: create(Data.Response_BanHistorySchema, { banList: [banEntry] }),
    })));

    expect(getMockResponse().moderator.banHistory).toHaveBeenCalledWith(
      'baduser',
      expect.arrayContaining([expect.objectContaining({ visibleReason: 'spamming' })]),
    );
  });

  it('viewLogHistory dispatches logs on success', () => {
    connectAndLogin();

    ModeratorCommands.viewLogHistory({ dateRange: 30 });

    const { cmdId } = findLastModeratorCommand(Data.Command_ViewLogHistory_ext);

    const logMsg = create(Data.ServerInfo_ChatMessageSchema, {
      senderName: 'alice',
      message: 'test message',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ViewLogHistory_ext,
      value: create(Data.Response_ViewLogHistorySchema, { logMessage: [logMsg] }),
    })));

    expect(getMockResponse().moderator.viewLogs).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ senderName: 'alice' })]),
    );
  });

  it('warnUser sends command and dispatches on success', () => {
    connectAndLogin();

    ModeratorCommands.warnUser('troublemaker', 'spamming chat');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_WarnUser_ext);
    expect(value.userName).toBe('troublemaker');
    expect(value.reason).toBe('spamming chat');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().moderator.warnUser).toHaveBeenCalledWith('troublemaker');
  });

  it('banFromServer sends command and dispatches on success', () => {
    connectAndLogin();

    ModeratorCommands.banFromServer(60, 'baduser', undefined, 'repeated offenses', 'rule violation');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_BanFromServer_ext);
    expect(value.userName).toBe('baduser');
    expect(value.minutes).toBe(60);
    expect(value.visibleReason).toBe('rule violation');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().moderator.banFromServer).toHaveBeenCalledWith('baduser');
  });

  it('getWarnHistory dispatches warnHistory on success', () => {
    connectAndLogin();

    ModeratorCommands.getWarnHistory('baduser');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_GetWarnHistory_ext);
    expect(value.userName).toBe('baduser');

    const warning = create(Data.ServerInfo_WarningSchema, {
      adminName: 'Admin',
      reason: 'spamming',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_WarnHistory_ext,
      value: create(Data.Response_WarnHistorySchema, { warnList: [warning] }),
    })));

    expect(getMockResponse().moderator.warnHistory).toHaveBeenCalledWith(
      'baduser',
      expect.arrayContaining([expect.objectContaining({ reason: 'spamming' })]),
    );
  });

  it('getWarnList dispatches warnListOptions on success', () => {
    connectAndLogin();

    ModeratorCommands.getWarnList('mod', 'troublemaker', 'client-1');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_GetWarnList_ext);
    expect(value.modName).toBe('mod');
    expect(value.userName).toBe('troublemaker');
    expect(value.userClientid).toBe('client-1');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_WarnList_ext,
      value: create(Data.Response_WarnListSchema, { warning: ['spam', 'abuse'] }),
    })));

    expect(getMockResponse().moderator.warnListOptions).toHaveBeenCalled();
  });

  it('forceActivateUser sends command and dispatches on RespOk', () => {
    connectAndLogin();

    ModeratorCommands.forceActivateUser('inactive', 'mod');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_ForceActivateUser_ext);
    expect(value.usernameToActivate).toBe('inactive');
    expect(value.moderatorName).toBe('mod');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().moderator.forceActivateUser).toHaveBeenCalledWith('inactive', 'mod');
  });

  it('getAdminNotes dispatches getAdminNotes on success', () => {
    connectAndLogin();

    ModeratorCommands.getAdminNotes('subject');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_GetAdminNotes_ext);
    expect(value.userName).toBe('subject');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_GetAdminNotes_ext,
      value: create(Data.Response_GetAdminNotesSchema, { notes: 'prior offenses' }),
    })));

    expect(getMockResponse().moderator.getAdminNotes).toHaveBeenCalledWith('subject', 'prior offenses');
  });

  it('updateAdminNotes sends notes payload and dispatches on RespOk', () => {
    connectAndLogin();

    ModeratorCommands.updateAdminNotes('subject', 'updated notes text');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_UpdateAdminNotes_ext);
    expect(value.userName).toBe('subject');
    expect(value.notes).toBe('updated notes text');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().moderator.updateAdminNotes).toHaveBeenCalledWith('subject', 'updated notes text');
  });

  it('grantReplayAccess sends command and dispatches on RespOk', () => {
    connectAndLogin();

    ModeratorCommands.grantReplayAccess(42, 'mod');

    const { cmdId, value } = findLastModeratorCommand(Data.Command_GrantReplayAccess_ext);
    expect(value.replayId).toBe(42);
    expect(value.moderatorName).toBe('mod');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().moderator.grantReplayAccess).toHaveBeenCalledWith(42, 'mod');
  });
});
