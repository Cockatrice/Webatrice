import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import {
  Command_ReplayDownloadByGameId_ext,
  Command_ReplayDownloadByGameIdSchema,
  Response_ReplayDownloadByGameId_ext,
} from '../../generated';

export function replayDownloadByGameId(gameId: number, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.response.moderator.replayDownloadByGameIdPending?.(gameId);
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_ReplayDownloadByGameId_ext,
    create(Command_ReplayDownloadByGameIdSchema, { gameId }),
    {
      responseExt: Response_ReplayDownloadByGameId_ext,
      onSuccess: (response) => {
        WebClient.instance.response.moderator.replayDownloadedByGameId?.(gameId, response, ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.(
          'replayDownloadByGameId', responseCode, String(gameId), failure, ...correlation,
        );
      },
    },
  );
}
