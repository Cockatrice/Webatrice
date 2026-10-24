import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_ReportList_ext, Command_ReportListSchema, Response_ReportList_ext } from '../../generated';

export function reportList(unresolvedOnly?: boolean, offset?: number, limit?: number, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_ReportList_ext,
    create(Command_ReportListSchema, { unresolvedOnly, offset, limit }),
    {
      responseExt: Response_ReportList_ext,
      onSuccess: (response) => {
        WebClient.instance.response.moderator.reportList?.(response.reports, response.totalCount, ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('reportList', responseCode, '', failure, ...correlation);
      },
    },
  );
}
