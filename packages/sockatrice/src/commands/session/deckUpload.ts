import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_DeckUpload_ext, Command_DeckUploadSchema, Response_DeckUpload_ext } from '../../generated';
import type { RequestId } from '../../types/RequestId';
import { deckUploadedItem } from './deckUploadedItem';

export function deckUpload(
  path: string, deckId: number, deckList: string, isPublic?: boolean, colorIdentity?: string,
  ...correlation: [requestId?: RequestId]
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckUpload_ext,
    create(Command_DeckUploadSchema, { path, deckId, deckList, isPublic, colorIdentity }),
    {
      responseExt: Response_DeckUpload_ext,
      onSuccess: (response) => {
        const uploaded = deckUploadedItem(response.newFile, colorIdentity);
        if (uploaded) {
          WebClient.instance.response.session.uploadServerDeck(path, uploaded, ...correlation);
        }
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.session.deckUploadFailed?.(path, responseCode, failure, ...correlation);
      },
    }
  );
}
