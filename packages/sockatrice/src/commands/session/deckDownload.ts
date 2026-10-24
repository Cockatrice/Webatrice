import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_DeckDownload_ext, Command_DeckDownloadSchema, Response_DeckDownload_ext } from '../../generated';

export function deckDownload(deckId: number, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckDownload_ext,
    create(Command_DeckDownloadSchema, { deckId }),
    {
      responseExt: Response_DeckDownload_ext,
      onSuccess: (response) => {
        WebClient.instance.response.session.downloadServerDeck(deckId, response, ...correlation);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.session.deckDownloadFailed?.(deckId, responseCode, failure, ...correlation);
      },
    }
  );
}
