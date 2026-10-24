import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';
import * as Data from '../../src/generated';
import { SessionCommands } from '../../src';
import { connectAndLogin, getMockResponse } from '../../src/testing/setup';
import { buildResponse, buildResponseMessage, deliverMessage } from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';

describe('replay-list protocol correlation', () => {
  it.each(['success', 'failure'])('identifies an older %s arriving after a newer list', (outcome) => {
    connectAndLogin();
    SessionCommands.replayList('first');
    const first = findLastSessionCommand(Data.Command_ReplayList_ext);
    SessionCommands.replayList('second');
    const second = findLastSessionCommand(Data.Command_ReplayList_ext);
    expect(first.value).toEqual(create(Data.Command_ReplayListSchema));
    expect(second.value).toEqual(first.value);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: second.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayList_ext,
      value: create(Data.Response_ReplayListSchema, {
        matchList: [create(Data.ServerInfo_ReplayMatchSchema, { gameId: 2 })],
      }),
    })));
    expect(getMockResponse().session.replayList).toHaveBeenCalledWith(
      [expect.objectContaining({ gameId: 2 })], 'second',
    );

    if (outcome === 'success') {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: first.cmdId,
        responseCode: Data.Response_ResponseCode.RespOk,
        ext: Data.Response_ReplayList_ext,
        value: create(Data.Response_ReplayListSchema, {
          matchList: [create(Data.ServerInfo_ReplayMatchSchema, { gameId: 1 })],
        }),
      })));
      expect(getMockResponse().session.replayList).toHaveBeenLastCalledWith(
        [expect.objectContaining({ gameId: 1 })], 'first',
      );
    } else {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: first.cmdId,
        responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed,
      })));
      expect(getMockResponse().session.replayListFailed).toHaveBeenCalledWith(
        Data.Response_ResponseCode.RespFunctionNotAllowed, undefined, 'first',
      );
    }
  });
});
