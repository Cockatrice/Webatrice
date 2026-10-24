import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_GetServerStats_ext, Command_GetServerStatsSchema, Response_GetServerStats_ext } from '../../generated';

export function getServerStats(): void {
  WebClient.instance.protobuf.sendDeveloperCommand(Command_GetServerStats_ext, create(Command_GetServerStatsSchema), {
    responseExt: Response_GetServerStats_ext,
    onSuccess: (response) => {
      WebClient.instance.response.developer?.serverStats?.(response);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.developer?.commandFailed?.('getServerStats', responseCode, '', failure);
    },
  });
}
