vi.mock('../../WebClient');

import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { WebClient } from '../../WebClient';
import { adjustMod } from './adjustMod';
import { reloadConfig } from './reloadConfig';
import { shutdownServer } from './shutdownServer';
import { updateServerMessage } from './updateServerMessage';
import {
  Command_AdjustMod_ext,
  Command_ReloadConfig_ext,
  Command_ShutdownServer_ext,
  Command_UpdateServerMessage_ext,
  Response_ResponseCode,
} from '../../generated';

import { Mock } from 'vitest';

const { invokeOnSuccess, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendAdminCommand as Mock,
  2
);

describe('adjustMod', () => {

  it('calls sendAdminCommand with Command_AdjustMod extension and fields', () => {
    adjustMod('alice', true, false);
    expect(WebClient.instance.protobuf.sendAdminCommand).toHaveBeenCalledWith(
      Command_AdjustMod_ext,
      expect.objectContaining({ userName: 'alice', shouldBeMod: true, shouldBeJudge: false }),
      expect.any(Object)
    );
  });

  it('onSuccess calls response.admin.adjustMod', () => {
    adjustMod('alice', true, false);
    invokeOnSuccess();
    expect(WebClient.instance.response.admin.adjustMod).toHaveBeenCalledWith('alice', true, false);
  });

  it('does not call response.admin.adjustMod on permission-denied response and does not retry', () => {
    adjustMod('alice', true, false);
    (WebClient.instance.protobuf.sendAdminCommand as Mock).mockClear();
    invokeOnError(Response_ResponseCode.RespAccessDenied);
    expect(WebClient.instance.response.admin.adjustMod).not.toHaveBeenCalled();
    expect(WebClient.instance.protobuf.sendAdminCommand).not.toHaveBeenCalled();
  });
});

describe('reloadConfig', () => {

  it('calls sendAdminCommand with Command_ReloadConfig extension', () => {
    reloadConfig();
    expect(WebClient.instance.protobuf.sendAdminCommand).toHaveBeenCalledWith(
      Command_ReloadConfig_ext,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('onSuccess calls response.admin.reloadConfig', () => {
    reloadConfig();
    invokeOnSuccess();
    expect(WebClient.instance.response.admin.reloadConfig).toHaveBeenCalled();
  });
});

describe('shutdownServer', () => {

  it('calls sendAdminCommand with Command_ShutdownServer extension and fields', () => {
    shutdownServer('maintenance', 10);
    expect(WebClient.instance.protobuf.sendAdminCommand).toHaveBeenCalledWith(
      Command_ShutdownServer_ext,
      expect.objectContaining({ reason: 'maintenance', minutes: 10 }),
      expect.any(Object)
    );
  });

  it('onSuccess calls response.admin.shutdownServer', () => {
    shutdownServer('maintenance', 10);
    invokeOnSuccess();
    expect(WebClient.instance.response.admin.shutdownServer).toHaveBeenCalled();
  });

  it('does not call response.admin.shutdownServer on non-Ok response code', () => {
    shutdownServer('maintenance', 10);
    invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
    expect(WebClient.instance.response.admin.shutdownServer).not.toHaveBeenCalled();
  });
});

describe('updateServerMessage', () => {

  it('calls sendAdminCommand with Command_UpdateServerMessage extension', () => {
    updateServerMessage();
    expect(WebClient.instance.protobuf.sendAdminCommand).toHaveBeenCalledWith(
      Command_UpdateServerMessage_ext,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('onSuccess calls response.admin.updateServerMessage', () => {
    updateServerMessage();
    invokeOnSuccess();
    expect(WebClient.instance.response.admin.updateServerMessage).toHaveBeenCalled();
  });
});
