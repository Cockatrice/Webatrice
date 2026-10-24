import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_ReportUserInfo_ext, Command_ReportUserInfoSchema, Response_ReportUserInfo_ext } from '../../generated';

export function reportUserInfo(userName: string, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_ReportUserInfo_ext,
    create(Command_ReportUserInfoSchema, { userName }),
    {
      responseExt: Response_ReportUserInfo_ext,
      onSuccess: (response) => {
        WebClient.instance.response.moderator.reportUserInfo?.(response, ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('reportUserInfo', responseCode, userName, failure, ...correlation);
      },
    },
  );
}
