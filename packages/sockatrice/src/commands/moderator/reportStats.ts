import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_ReportStats_ext, Command_ReportStatsSchema, Response_ReportStats_ext } from '../../generated';

export function reportStats(...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(Command_ReportStats_ext, create(Command_ReportStatsSchema), {
    responseExt: Response_ReportStats_ext,
    onSuccess: (response) => {
      WebClient.instance.response.moderator.reportStats?.(response, ...correlation);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.('reportStats', responseCode, '', failure, ...correlation);
    },
  });
}
