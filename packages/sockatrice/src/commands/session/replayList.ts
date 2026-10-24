import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_ReplayList_ext, Command_ReplayListSchema, Response_ReplayList_ext } from '../../generated';

export function replayList(...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_ReplayList_ext, create(Command_ReplayListSchema), {
    responseExt: Response_ReplayList_ext,
    onSuccess: (response) => {
      WebClient.instance.response.session.replayList(response.matchList, ...correlation);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.session.replayListFailed?.(responseCode, failure, ...correlation);
    },
  });
}
