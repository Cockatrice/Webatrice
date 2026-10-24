import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_ViewLogHistory_dev_ext, Command_ViewLogHistorySchema, Response_ViewLogHistory_ext } from '../../generated';
import type { ViewLogHistoryParams } from '../../generated';

export function viewLogHistory(filters: ViewLogHistoryParams, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendDeveloperCommand(Command_ViewLogHistory_dev_ext, create(Command_ViewLogHistorySchema, filters), {
    responseExt: Response_ViewLogHistory_ext,
    onSuccess: (response) => {
      WebClient.instance.response.moderator.viewLogs(response.logMessage, ...correlation);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.(
        'viewLogHistory', responseCode, filters.userName ?? '', failure, ...correlation,
      );
    },
  });
}
