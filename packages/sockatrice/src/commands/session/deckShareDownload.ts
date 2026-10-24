import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_DeckShareDownload_ext, Command_DeckShareDownloadSchema, Response_DeckShareDownload_ext } from '../../generated';

export function deckShareDownload(token: string, itemId: number): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckShareDownload_ext,
    create(Command_DeckShareDownloadSchema, { token, itemId }),
    {
      responseExt: Response_DeckShareDownload_ext,
      onSuccess: (response) => {
        WebClient.instance.response.session.deckShareDownloaded?.(token, itemId, response.deck);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.session.commandFailed?.('deckShareDownload', responseCode, token, failure);
      },
    }
  );
}
