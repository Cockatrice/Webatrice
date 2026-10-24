import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_ReportAssign_ext, Command_ReportAssignSchema } from '../../generated';

export function reportAssign(reportId: number, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(Command_ReportAssign_ext, create(Command_ReportAssignSchema, { reportId }), {
    onSuccess: () => {
      WebClient.instance.response.moderator.reportAssigned?.(reportId, ...correlation);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.('reportAssign', responseCode, String(reportId), failure, ...correlation);
    },
  });
}
