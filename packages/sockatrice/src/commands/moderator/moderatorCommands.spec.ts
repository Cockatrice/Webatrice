vi.mock('../../WebClient');

import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { WebClient } from '../../WebClient';
import {
  Command_BanFromServer_ext,
  Command_ForceActivateUser_ext,
  Command_GetAdminNotes_ext,
  Command_GetBanHistory_ext,
  Command_GetWarnHistory_ext,
  Command_GetWarnList_ext,
  Command_GrantReplayAccess_ext,
  Command_UpdateAdminNotes_ext,
  Command_ViewLogHistory_ext,
  Command_ViewLogHistorySchema,
  Command_WarnUser_ext,
  Response_BanHistory_ext,
  Response_GetAdminNotes_ext,
  Response_ResponseCode,
  Response_ViewLogHistory_ext,
  Response_WarnHistory_ext,
  Response_WarnList_ext,
  ServerInfo_BanSchema,
  ServerInfo_ChatMessageSchema,
  ServerInfo_WarningSchema,
} from '../../generated';

import { banFromServer } from './banFromServer';
import { forceActivateUser } from './forceActivateUser';
import { getAdminNotes } from './getAdminNotes';
import { getBanHistory } from './getBanHistory';
import { getWarnHistory } from './getWarnHistory';
import { getWarnList } from './getWarnList';
import { grantReplayAccess } from './grantReplayAccess';
import { updateAdminNotes } from './updateAdminNotes';
import { viewLogHistory } from './viewLogHistory';
import { warnUser } from './warnUser';
import { create } from '@bufbuild/protobuf';
import { Mock } from 'vitest';

const { invokeOnSuccess, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendModeratorCommand as Mock,
  2
);

describe('banFromServer', () => {

  it('calls sendModeratorCommand with Command_BanFromServer', () => {
    banFromServer(30, 'alice', '1.2.3.4', 'reason', 'visible', 'cid', 1);
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_BanFromServer_ext,
      expect.objectContaining({ minutes: 30, userName: 'alice' }),
      expect.any(Object)
    );
  });

  it('onSuccess calls response.moderator.banFromServer', () => {
    banFromServer(30, 'alice');
    invokeOnSuccess();
    expect(WebClient.instance.response.moderator.banFromServer).toHaveBeenCalledWith('alice');
  });
});

describe('forceActivateUser', () => {

  it('calls sendModeratorCommand with Command_ForceActivateUser', () => {
    forceActivateUser('alice', 'mod1');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_ForceActivateUser_ext, expect.any(Object), expect.any(Object)
    );
  });

  it('onSuccess calls response.moderator.forceActivateUser', () => {
    forceActivateUser('alice', 'mod1');
    invokeOnSuccess();
    expect(WebClient.instance.response.moderator.forceActivateUser).toHaveBeenCalledWith('alice', 'mod1');
  });
});

describe('getAdminNotes', () => {

  it('calls sendModeratorCommand with Command_GetAdminNotes', () => {
    getAdminNotes('alice');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GetAdminNotes_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_GetAdminNotes_ext })
    );
  });

  it('onSuccess calls response.moderator.getAdminNotes with notes', () => {
    getAdminNotes('alice');
    const resp = { notes: 'some notes' };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.moderator.getAdminNotes).toHaveBeenCalledWith('alice', 'some notes');
  });

  it('does not call response.moderator.getAdminNotes on RespAccessDenied', () => {
    getAdminNotes('alice');
    invokeOnError(Response_ResponseCode.RespAccessDenied);
    expect(WebClient.instance.response.moderator.getAdminNotes).not.toHaveBeenCalled();
  });
});

describe('getBanHistory', () => {

  it('calls sendModeratorCommand with Command_GetBanHistory', () => {
    getBanHistory('alice');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GetBanHistory_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_BanHistory_ext })
    );
  });

  it('onSuccess calls response.moderator.banHistory with banList', () => {
    getBanHistory('alice');
    const resp = { banList: [{ id: 1 }] };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.moderator.banHistory).toHaveBeenCalledWith('alice', [{ id: 1 }]);
  });

  it('forwards decoded ServerInfo_Ban entries to response.moderator.banHistory', () => {
    getBanHistory('alice');
    const banList = [
      create(ServerInfo_BanSchema, {
        adminId: '7',
        adminName: 'mod1',
        banTime: '2025-01-02T03:04:05Z',
        banLength: '60',
        banReason: 'spam',
        visibleReason: 'breaking rules',
      }),
      create(ServerInfo_BanSchema, {
        adminId: '8',
        adminName: 'mod2',
        banTime: '2025-02-03T04:05:06Z',
        banLength: '30',
      }),
    ];
    invokeOnSuccess({ banList }, { responseCode: Response_ResponseCode.RespOk });
    expect(WebClient.instance.response.moderator.banHistory).toHaveBeenCalledWith('alice', banList);
    const [, forwarded] = (WebClient.instance.response.moderator.banHistory as Mock).mock.calls[0];
    expect(forwarded).toHaveLength(2);
    expect(forwarded[0]).toMatchObject({
      adminId: '7',
      adminName: 'mod1',
      banTime: '2025-01-02T03:04:05Z',
      banLength: '60',
      banReason: 'spam',
      visibleReason: 'breaking rules',
    });
  });
});

describe('getWarnHistory', () => {

  it('calls sendModeratorCommand with Command_GetWarnHistory', () => {
    getWarnHistory('alice');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GetWarnHistory_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_WarnHistory_ext })
    );
  });

  it('onSuccess calls response.moderator.warnHistory with warnList', () => {
    getWarnHistory('alice');
    const resp = { warnList: [{ id: 2 }] };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.moderator.warnHistory).toHaveBeenCalledWith('alice', [{ id: 2 }]);
  });

  it('forwards decoded ServerInfo_Warning entries to response.moderator.warnHistory', () => {
    getWarnHistory('alice');
    const warnList = [
      create(ServerInfo_WarningSchema, {
        userName: 'alice',
        adminName: 'mod1',
        reason: 'unsportsmanlike',
        timeOf: '2025-03-01T12:00:00Z',
      }),
    ];
    invokeOnSuccess({ warnList }, { responseCode: Response_ResponseCode.RespOk });
    expect(WebClient.instance.response.moderator.warnHistory).toHaveBeenCalledWith('alice', warnList);
    const [, forwarded] = (WebClient.instance.response.moderator.warnHistory as Mock).mock.calls[0];
    expect(forwarded[0]).toMatchObject({
      userName: 'alice',
      adminName: 'mod1',
      reason: 'unsportsmanlike',
      timeOf: '2025-03-01T12:00:00Z',
    });
  });
});

describe('getWarnList', () => {

  it('calls sendModeratorCommand with Command_GetWarnList', () => {
    getWarnList('mod1', 'alice', 'US');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GetWarnList_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_WarnList_ext })
    );
  });

  it('onSuccess calls response.moderator.warnListOptions with the response', () => {
    getWarnList('mod1', 'alice', 'US');
    const resp = { warning: ['w1', 'w2'], userName: 'alice', userClientid: 'US' };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.moderator.warnListOptions).toHaveBeenCalledWith([resp]);
  });

  it('forwards paginated warning options preserving userName and userClientid', () => {
    getWarnList('mod1', 'alice', 'US');
    const resp = {
      warning: ['spam', 'harassment', 'cheating', 'griefing'],
      userName: 'alice',
      userClientid: 'US',
    };
    invokeOnSuccess(resp, { responseCode: Response_ResponseCode.RespOk });
    expect(WebClient.instance.response.moderator.warnListOptions).toHaveBeenCalledTimes(1);
    const [forwarded] = (WebClient.instance.response.moderator.warnListOptions as Mock).mock.calls[0];
    expect(forwarded).toEqual([resp]);
    expect(forwarded[0].warning).toHaveLength(4);
    expect(forwarded[0].userName).toBe('alice');
    expect(forwarded[0].userClientid).toBe('US');
  });
});

describe('grantReplayAccess', () => {

  it('calls sendModeratorCommand with Command_GrantReplayAccess', () => {
    grantReplayAccess(10, 'mod1');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_GrantReplayAccess_ext, expect.any(Object), expect.any(Object)
    );
  });

  it('onSuccess calls response.moderator.grantReplayAccess', () => {
    grantReplayAccess(10, 'mod1');
    invokeOnSuccess();
    expect(WebClient.instance.response.moderator.grantReplayAccess).toHaveBeenCalledWith(10, 'mod1');
  });
});

describe('updateAdminNotes', () => {

  it('calls sendModeratorCommand with Command_UpdateAdminNotes', () => {
    updateAdminNotes('alice', 'new notes');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_UpdateAdminNotes_ext, expect.any(Object), expect.any(Object)
    );
  });

  it('onSuccess calls response.moderator.updateAdminNotes', () => {
    updateAdminNotes('alice', 'new notes');
    invokeOnSuccess();
    expect(WebClient.instance.response.moderator.updateAdminNotes).toHaveBeenCalledWith('alice', 'new notes');
  });

  it('RespOk confirms the update with the submitted username and notes', () => {
    updateAdminNotes('bob', 'updated note body');
    invokeOnSuccess(undefined, { responseCode: Response_ResponseCode.RespOk });
    expect(WebClient.instance.response.moderator.updateAdminNotes).toHaveBeenCalledTimes(1);
    expect(WebClient.instance.response.moderator.updateAdminNotes).toHaveBeenCalledWith('bob', 'updated note body');
  });

  it('does not confirm the update on RespAccessDenied and does not silently retry', () => {
    updateAdminNotes('alice', 'new notes');
    (WebClient.instance.protobuf.sendModeratorCommand as Mock).mockClear();
    invokeOnError(Response_ResponseCode.RespAccessDenied);
    expect(WebClient.instance.response.moderator.updateAdminNotes).not.toHaveBeenCalled();
    expect(WebClient.instance.protobuf.sendModeratorCommand).not.toHaveBeenCalled();
  });
});

describe('viewLogHistory', () => {

  it('calls sendModeratorCommand with Command_ViewLogHistory', () => {
    const filters = create(Command_ViewLogHistorySchema, { dateRange: 7 });
    viewLogHistory(filters);
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_ViewLogHistory_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_ViewLogHistory_ext })
    );
  });

  it('onSuccess calls response.moderator.viewLogs with logMessage', () => {
    const filters = create(Command_ViewLogHistorySchema, { dateRange: 7 });
    viewLogHistory(filters);
    const resp = { logMessage: ['log1'] };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.moderator.viewLogs).toHaveBeenCalledWith(['log1']);
  });

  it('forwards decoded ServerInfo_ChatMessage entries to response.moderator.viewLogs', () => {
    const filters = create(Command_ViewLogHistorySchema, { dateRange: 7 });
    viewLogHistory(filters);
    const logMessage = [
      create(ServerInfo_ChatMessageSchema, {
        time: '2025-04-01T09:30:00Z',
        senderId: '42',
        senderName: 'alice',
        senderIp: '10.0.0.1',
        message: 'hello room',
        targetType: 'room',
        targetId: '1',
        targetName: 'Magic',
      }),
    ];
    invokeOnSuccess({ logMessage }, { responseCode: Response_ResponseCode.RespOk });
    expect(WebClient.instance.response.moderator.viewLogs).toHaveBeenCalledWith(logMessage);
    const [forwarded] = (WebClient.instance.response.moderator.viewLogs as Mock).mock.calls[0];
    expect(forwarded[0]).toMatchObject({
      senderName: 'alice',
      message: 'hello room',
      targetType: 'room',
      targetName: 'Magic',
    });
  });
});

describe('warnUser', () => {

  it('calls sendModeratorCommand with Command_WarnUser', () => {
    warnUser('alice', 'bad behavior', 'cid');
    expect(WebClient.instance.protobuf.sendModeratorCommand).toHaveBeenCalledWith(
      Command_WarnUser_ext, expect.any(Object), expect.any(Object)
    );
  });

  it('onSuccess calls response.moderator.warnUser', () => {
    warnUser('alice', 'bad behavior', 'cid');
    invokeOnSuccess();
    expect(WebClient.instance.response.moderator.warnUser).toHaveBeenCalledWith('alice');
  });
});
