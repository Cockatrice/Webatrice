import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_ReportResolve_ext, Command_ReportResolveSchema } from '../../generated';

export function reportResolve(reportId: number, resolutionNote?: string, dismissed = false, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_ReportResolve_ext,
    create(Command_ReportResolveSchema, { reportId, resolutionNote, dismissed }),
    {
      onSuccess: () => {
        WebClient.instance.response.moderator.reportResolved?.(reportId, dismissed, ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('reportResolve', responseCode, String(reportId), failure, ...correlation);
      },
    },
  );
}
