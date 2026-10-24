import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_GetWarnList_ext, Command_GetWarnListSchema, Response_WarnList_ext } from '../../generated';

export function getWarnList(modName: string, userName: string, userClientid: string, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_GetWarnList_ext,
    create(Command_GetWarnListSchema, { modName, userName, userClientid }),
    {
      responseExt: Response_WarnList_ext,
      onSuccess: (response) => {
        WebClient.instance.response.moderator.warnListOptions([response], ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('warnList', responseCode, userName, failure, ...correlation);
      },
    }
  );
}
