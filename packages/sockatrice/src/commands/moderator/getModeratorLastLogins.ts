import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import {
  Command_GetModeratorLastLogins_ext,
  Command_GetModeratorLastLoginsSchema,
  Response_ModeratorLastLogins_ext,
} from '../../generated';

export function getModeratorLastLogins(): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_GetModeratorLastLogins_ext,
    create(Command_GetModeratorLastLoginsSchema),
    {
      responseExt: Response_ModeratorLastLogins_ext,
      onSuccess: (response) => {
        WebClient.instance.response.moderator.moderatorLastLogins?.(response.logins);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('getModeratorLastLogins', responseCode, '', failure);
      },
    },
  );
}
