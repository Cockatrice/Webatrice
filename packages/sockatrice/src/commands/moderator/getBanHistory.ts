import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_GetBanHistory_ext, Command_GetBanHistorySchema, Response_BanHistory_ext } from '../../generated';

export function getBanHistory(userName: string, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(Command_GetBanHistory_ext, create(Command_GetBanHistorySchema, { userName }), {
    responseExt: Response_BanHistory_ext,
    onSuccess: (response) => {
      WebClient.instance.response.moderator.banHistory(userName, response.banList, ...correlation);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.('banHistory', responseCode, userName, failure, ...correlation);
    },
  });
}
