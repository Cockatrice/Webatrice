import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_ReportAddComment_ext, Command_ReportAddCommentSchema } from '../../generated';

export function reportAddComment(
  reportId: number,
  comment: string,
  onAdded?: () => void,
  onFailure?: (responseCode: number) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_ReportAddComment_ext,
    create(Command_ReportAddCommentSchema, { reportId, comment }),
    {
      onSuccess: onAdded,
      onError: onFailure,
    }
  );
}
