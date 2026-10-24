import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_DeckNewDir_ext, Command_DeckNewDirSchema } from '../../generated';
import type { RequestId } from '../../types/RequestId';

export function deckNewDir(path: string, dirName: string, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_DeckNewDir_ext, create(Command_DeckNewDirSchema, { path, dirName }), {
    onSuccess: () => {
      WebClient.instance.response.session.createServerDeckDir(path, dirName, ...correlation);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.session.deckNewDirFailed?.(path, dirName, responseCode, failure, ...correlation);
    },
  });
}
