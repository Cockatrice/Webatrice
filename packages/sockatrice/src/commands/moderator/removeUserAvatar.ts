import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_RemoveUserAvatar_ext, Command_RemoveUserAvatarSchema, Response_RemoveUserAvatar_ext } from '../../generated';

export function removeUserAvatar(userName: string): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_RemoveUserAvatar_ext,
    create(Command_RemoveUserAvatarSchema, { userName }),
    {
      responseExt: Response_RemoveUserAvatar_ext,
      onSuccess: (response) => {
        WebClient.instance.response.moderator.userAvatarRemoved?.(response.userName || userName);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('removeUserAvatar', responseCode, userName, failure);
      },
    },
  );
}
