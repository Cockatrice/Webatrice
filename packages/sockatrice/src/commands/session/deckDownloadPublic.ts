import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_DeckDownloadPublic_ext, Command_DeckDownloadPublicSchema, Response_DeckDownload_ext } from '../../generated';

export function deckDownloadPublic(deckId: number): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckDownloadPublic_ext,
    create(Command_DeckDownloadPublicSchema, { deckId }),
    {
      responseExt: Response_DeckDownload_ext,
      onSuccess: (response) => {
        WebClient.instance.response.session.publicDeckDownloaded?.(deckId, response.deck);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.session.commandFailed?.('deckDownloadPublic', responseCode, String(deckId), failure);
      },
    }
  );
}
