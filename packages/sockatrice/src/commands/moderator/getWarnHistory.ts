import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_GetWarnHistory_ext, Command_GetWarnHistorySchema, Response_WarnHistory_ext } from '../../generated';

export function getWarnHistory(userName: string, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_GetWarnHistory_ext,
    create(Command_GetWarnHistorySchema, { userName }),
    {
      responseExt: Response_WarnHistory_ext,
      onSuccess: (response) => {
        WebClient.instance.response.moderator.warnHistory(userName, response.warnList, ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('warnHistory', responseCode, userName, failure, ...correlation);
      },
    }
  );
}
