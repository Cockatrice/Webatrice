import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';
import { Command_ReportDetails_ext, Command_ReportDetailsSchema, Response_ReportDetails_ext } from '../../generated';

export function reportDetails(reportId: number, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_ReportDetails_ext,
    create(Command_ReportDetailsSchema, { reportId }),
    {
      responseExt: Response_ReportDetails_ext,
      onSuccess: (response) => {
        if (response.report) {
          WebClient.instance.response.session.reportDetails?.(response.report, ...correlation);
        }
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.session.commandFailed?.('reportDetails', responseCode, String(reportId), failure, ...correlation);
      },
    }
  );
}
