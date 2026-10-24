import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_Report_ext, Command_ReportSchema, type ReportParams } from '../../generated';

export function report(
  params: ReportParams,
  onSubmitted?: () => void,
  onFailure?: (responseCode: number) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_Report_ext,
    create(Command_ReportSchema, params),
    {
      onSuccess: onSubmitted,
      onError: onFailure,
    }
  );
}
