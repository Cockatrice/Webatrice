import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_GetUserAlts_ext, Command_GetUserAltsSchema, Response_UserAlts_ext } from '../../generated';

export function getUserAlts(userName: string): void {
  WebClient.instance.protobuf.sendModeratorCommand(Command_GetUserAlts_ext, create(Command_GetUserAltsSchema, { userName }), {
    responseExt: Response_UserAlts_ext,
    onSuccess: (response) => {
      WebClient.instance.response.moderator.userAlts?.(userName, response.alts);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.('getUserAlts', responseCode, userName, failure);
    },
  });
}
