import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_ForceActivateUser_ext, Command_ForceActivateUserSchema, Response_ResponseCode } from '../../generated';

export function forceActivateUser(usernameToActivate: string, moderatorName: string): void {
  const cmd = create(Command_ForceActivateUserSchema, { usernameToActivate, moderatorName });
  const activated = () => {
    WebClient.instance.response.moderator.forceActivateUser(usernameToActivate, moderatorName);
  };
  WebClient.instance.protobuf.sendModeratorCommand(Command_ForceActivateUser_ext, cmd, {
    onSuccess: () => {
      WebClient.instance.response.moderator.commandFailed?.('forceActivateUser', Response_ResponseCode.RespOk, usernameToActivate);
    },
    onResponseCode: {
      [Response_ResponseCode.RespActivationAccepted]: activated,
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.('forceActivateUser', responseCode, usernameToActivate, failure);
    },
  });
}
