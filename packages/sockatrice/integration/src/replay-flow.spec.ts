// Replay flow scenarios — end-to-end protocol wiring for the replay-sharing
// commands (submitCode/getCode/download/modifyMatch) plus the replayAdded
// session event. Per [[project_replay-sharing-deferred-ui]] the command
// wrappers exist already; these tests exercise them with the mock WebSocket.

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

describe('replay-flow: submit code → server stores → fetch code → download replay', () => {
  it('replaySubmitCode sends Command_ReplaySubmitCode with the supplied code', () => {
    connectAndLogin();

    SessionCommands.replaySubmitCode('ABC-123');

    const { value } = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    expect(value.replayCode).toBe('ABC-123');
  });

  it('replaySubmitCode invokes onSubmitted callback on RespOk', () => {
    connectAndLogin();

    const onSubmitted = vi.fn();
    SessionCommands.replaySubmitCode('XYZ-789', onSubmitted);

    const { cmdId } = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it('replaySubmitCode invokes onFailure with response code on non-Ok response', () => {
    connectAndLogin();

    const onSubmitted = vi.fn();
    const onFailure = vi.fn();
    SessionCommands.replaySubmitCode('BAD-CODE', onSubmitted, onFailure);

    const { cmdId } = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespNameNotFound,
    })));

    expect(onSubmitted).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0]).toBe(Data.Response_ResponseCode.RespNameNotFound);
  });

  it('replayGetCode round-trip delivers the replay code via the callback', () => {
    connectAndLogin();

    const onCodeReceived = vi.fn();
    SessionCommands.replayGetCode(42, onCodeReceived);

    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayGetCode_ext);
    expect(value.gameId).toBe(42);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayGetCode_ext,
      value: create(Data.Response_ReplayGetCodeSchema, { replayCode: 'SHARED-CODE-9' }),
    })));

    expect(onCodeReceived).toHaveBeenCalledWith('SHARED-CODE-9');
  });

  it('replayDownload dispatches replayDownloaded with the replay payload', () => {
    connectAndLogin();

    SessionCommands.replayDownload(99);

    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayDownload_ext);
    expect(value.replayId).toBe(99);

    const replayData = new Uint8Array([1, 2, 3, 4, 5]);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayDownload_ext,
      value: create(Data.Response_ReplayDownloadSchema, { replayData }),
    })));

    expect(getMockResponse().session.replayDownloaded).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ replayData: expect.any(Uint8Array) }),
    );
  });

  it('replayModifyMatch round-trip dispatches replayModifyMatch with gameId and doNotHide', () => {
    connectAndLogin();

    SessionCommands.replayModifyMatch(99, true);

    const { cmdId, value } = findLastSessionCommand(Data.Command_ReplayModifyMatch_ext);
    expect(value.gameId).toBe(99);
    expect(value.doNotHide).toBe(true);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().session.replayModifyMatch).toHaveBeenCalledWith(99, true);
  });

  it('Event_ReplayAdded dispatches session.replayAdded with the match info', () => {
    connectAndLogin();

    const matchInfo = create(Data.ServerInfo_ReplayMatchSchema, {
      gameId: 555,
      gameName: 'Shared Replay',
      roomName: 'Lobby',
      timeStarted: 1000,
      length: 60,
      playerNames: ['alice', 'bob'],
      doNotHide: false,
      replayList: [
        create(Data.ServerInfo_ReplaySchema, {
          replayId: 1,
          replayName: 'Game 1',
          duration: 60,
        }),
      ],
    });
    deliverMessage(buildSessionEventMessage(
      Data.Event_ReplayAdded_ext,
      create(Data.Event_ReplayAddedSchema, { matchInfo })
    ));

    expect(getMockResponse().session.replayAdded).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: 555, gameName: 'Shared Replay' }),
    );
  });

  it('full flow: submit code, list replays, fetch code, download, modify visibility', () => {
    connectAndLogin();

    SessionCommands.replaySubmitCode('FULL-FLOW');
    const submit = findLastSessionCommand(Data.Command_ReplaySubmitCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: submit.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    SessionCommands.replayList();
    const list = findLastSessionCommand(Data.Command_ReplayList_ext);
    const match = create(Data.ServerInfo_ReplayMatchSchema, {
      gameId: 700,
      gameName: 'Tournament Round 1',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: list.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayList_ext,
      value: create(Data.Response_ReplayListSchema, { matchList: [match] }),
    })));
    expect(getMockResponse().session.replayList).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ gameId: 700 })]),
    );

    const onCodeReceived = vi.fn();
    SessionCommands.replayGetCode(700, onCodeReceived);
    const getCode = findLastSessionCommand(Data.Command_ReplayGetCode_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: getCode.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayGetCode_ext,
      value: create(Data.Response_ReplayGetCodeSchema, { replayCode: 'CODE-700' }),
    })));
    expect(onCodeReceived).toHaveBeenCalledWith('CODE-700');

    SessionCommands.replayDownload(700);
    const dl = findLastSessionCommand(Data.Command_ReplayDownload_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: dl.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayDownload_ext,
      value: create(Data.Response_ReplayDownloadSchema, { replayData: new Uint8Array([9, 9, 9]) }),
    })));
    expect(getMockResponse().session.replayDownloaded).toHaveBeenCalledWith(700, expect.anything());

    SessionCommands.replayModifyMatch(700, false);
    const modify = findLastSessionCommand(Data.Command_ReplayModifyMatch_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: modify.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));
    expect(getMockResponse().session.replayModifyMatch).toHaveBeenCalledWith(700, false);
  });
});
