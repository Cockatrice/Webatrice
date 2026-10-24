import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { CommandFailure } from '../../types/CommandFailure';

import { Command_DeckUpload_ext, Command_DeckUploadSchema, Response_DeckUpload_ext } from '../../generated';
import { deckUploadedItem } from './deckUploadedItem';

export function deckUpdate(
  deckId: number,
  deckList: string,
  isPublic?: boolean,
  colorIdentity?: string,
  onSettled?: (error: { responseCode: number; failure?: CommandFailure } | null) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckUpload_ext,
    create(Command_DeckUploadSchema, { deckId, deckList, isPublic, colorIdentity }),
    {
      responseExt: Response_DeckUpload_ext,
      onSuccess: (response) => {
        WebClient.instance.response.session.updateServerDeck?.(deckId, deckUploadedItem(response.newFile, colorIdentity));
        onSettled?.(null);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.session.updateServerDeckFailed?.(deckId, responseCode, failure);
        onSettled?.({ responseCode, failure });
      },
    }
  );
}
