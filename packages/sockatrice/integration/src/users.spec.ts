// User-list and social scenarios — user presence, buddy/ignore lists, DMs.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import * as Data from '../../src/generated';
import { SessionCommands } from '../../src';

import { connectAndLogin, getMockResponse } from '../../src/testing/setup';
import {
  buildResponse,
  buildResponseMessage,
  buildSessionEventMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

function makeUser(name: string): Data.ServerInfo_User {
  return create(Data.ServerInfo_UserSchema, {
    name,
    userLevel: Data.ServerInfo_User_UserLevelFlag.IsRegistered,
  });
}

describe('users', () => {
  it('dispatches updateUsers from the Response_ListUsers post-login', () => {
    connectAndLogin();

    const listUsers = findLastSessionCommand(Data.Command_ListUsers_ext);
    const users = [makeUser('alice'), makeUser('bob'), makeUser('carol')];
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: listUsers.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ListUsers_ext,
      value: create(Data.Response_ListUsersSchema, { userList: users }),
    })));

    expect(getMockResponse().session.updateUsers).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'alice' }),
        expect.objectContaining({ name: 'bob' }),
        expect.objectContaining({ name: 'carol' }),
      ]),
    );
  });

  it('dispatches userJoined on Event_UserJoined and userLeft on Event_UserLeft', () => {
    connectAndLogin();

    deliverMessage(buildSessionEventMessage(
      Data.Event_UserJoined_ext,
      create(Data.Event_UserJoinedSchema, { userInfo: makeUser('bob') })
    ));
    expect(getMockResponse().session.userJoined).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bob' }),
    );

    deliverMessage(buildSessionEventMessage(
      Data.Event_UserLeft_ext,
      create(Data.Event_UserLeftSchema, { name: 'bob' })
    ));
    expect(getMockResponse().session.userLeft).toHaveBeenCalledWith('bob');
  });

  it('dispatches addToBuddyList on Event_AddToList with listName=buddy', () => {
    connectAndLogin();

    deliverMessage(buildSessionEventMessage(
      Data.Event_AddToList_ext,
      create(Data.Event_AddToListSchema, {
        listName: 'buddy',
        userInfo: makeUser('bob'),
      })
    ));

    expect(getMockResponse().session.addToBuddyList).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'bob' }),
    );
  });

  it('dispatches addToIgnoreList on Event_AddToList with listName=ignore', () => {
    connectAndLogin();

    deliverMessage(buildSessionEventMessage(
      Data.Event_AddToList_ext,
      create(Data.Event_AddToListSchema, {
        listName: 'ignore',
        userInfo: makeUser('mallory'),
      })
    ));

    expect(getMockResponse().session.addToIgnoreList).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mallory' }),
    );
  });

  describe('buddy / ignore list commands', () => {
    it('sends Command_AddToList and dispatches addToList on RespOk for the buddy list', () => {
      connectAndLogin();

      SessionCommands.addToBuddyList('charlie');

      const { cmdId, value } = findLastSessionCommand(Data.Command_AddToList_ext);
      expect(value.list).toBe('buddy');
      expect(value.userName).toBe('charlie');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
      })));

      expect(getMockResponse().session.addToList).toHaveBeenCalledWith('buddy', 'charlie');
    });

    it('sends Command_AddToList for the ignore list', () => {
      connectAndLogin();

      SessionCommands.addToIgnoreList('mallory');

      const { cmdId, value } = findLastSessionCommand(Data.Command_AddToList_ext);
      expect(value.list).toBe('ignore');
      expect(value.userName).toBe('mallory');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
      })));

      expect(getMockResponse().session.addToList).toHaveBeenCalledWith('ignore', 'mallory');
    });

    it('sends Command_RemoveFromList and dispatches removeFromList on RespOk for the buddy list', () => {
      connectAndLogin();

      SessionCommands.removeFromBuddyList('charlie');

      const { cmdId, value } = findLastSessionCommand(Data.Command_RemoveFromList_ext);
      expect(value.list).toBe('buddy');
      expect(value.userName).toBe('charlie');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
      })));

      expect(getMockResponse().session.removeFromList).toHaveBeenCalledWith('buddy', 'charlie');
    });

    it('sends Command_RemoveFromList for the ignore list', () => {
      connectAndLogin();

      SessionCommands.removeFromIgnoreList('mallory');

      const { cmdId, value } = findLastSessionCommand(Data.Command_RemoveFromList_ext);
      expect(value.list).toBe('ignore');
      expect(value.userName).toBe('mallory');

      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
      })));

      expect(getMockResponse().session.removeFromList).toHaveBeenCalledWith('ignore', 'mallory');
    });
  });

  describe('Event_RemoveFromList', () => {
    it('dispatches removeFromBuddyList when listName is buddy', () => {
      connectAndLogin();

      deliverMessage(buildSessionEventMessage(
        Data.Event_RemoveFromList_ext,
        create(Data.Event_RemoveFromListSchema, { listName: 'buddy', userName: 'bob' })
      ));

      expect(getMockResponse().session.removeFromBuddyList).toHaveBeenCalledWith('bob');
      expect(getMockResponse().session.removeFromIgnoreList).not.toHaveBeenCalled();
    });

    it('dispatches removeFromIgnoreList when listName is ignore', () => {
      connectAndLogin();

      deliverMessage(buildSessionEventMessage(
        Data.Event_RemoveFromList_ext,
        create(Data.Event_RemoveFromListSchema, { listName: 'ignore', userName: 'mallory' })
      ));

      expect(getMockResponse().session.removeFromIgnoreList).toHaveBeenCalledWith('mallory');
      expect(getMockResponse().session.removeFromBuddyList).not.toHaveBeenCalled();
    });

    it('logs and dispatches nothing for an unknown list name', () => {
      connectAndLogin();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      deliverMessage(buildSessionEventMessage(
        Data.Event_RemoveFromList_ext,
        create(Data.Event_RemoveFromListSchema, { listName: 'mystery', userName: 'nobody' })
      ));

      expect(logSpy).toHaveBeenCalledWith('Attempted to remove from unknown list: mystery');
      expect(getMockResponse().session.removeFromBuddyList).not.toHaveBeenCalled();
      expect(getMockResponse().session.removeFromIgnoreList).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  it('dispatches userMessage for an incoming direct message', () => {
    connectAndLogin('alice');

    deliverMessage(buildSessionEventMessage(
      Data.Event_UserMessage_ext,
      create(Data.Event_UserMessageSchema, {
        senderName: 'bob',
        receiverName: 'alice',
        message: 'hi alice',
      })
    ));

    expect(getMockResponse().session.userMessage).toHaveBeenCalledWith(
      expect.objectContaining({ senderName: 'bob', message: 'hi alice' }),
    );
  });

  it('dispatches userMessage for an outgoing direct message', () => {
    connectAndLogin('alice');

    deliverMessage(buildSessionEventMessage(
      Data.Event_UserMessage_ext,
      create(Data.Event_UserMessageSchema, {
        senderName: 'alice',
        receiverName: 'bob',
        message: 'hey bob',
      })
    ));

    expect(getMockResponse().session.userMessage).toHaveBeenCalledWith(
      expect.objectContaining({ senderName: 'alice', receiverName: 'bob' }),
    );
  });
});
