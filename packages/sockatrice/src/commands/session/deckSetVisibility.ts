import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_DeckSetVisibility_ext, Command_DeckSetVisibilitySchema, type DeckSetVisibilityParams } from '../../generated';

export function deckSetVisibility(params: DeckSetVisibilityParams): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckSetVisibility_ext,
    create(Command_DeckSetVisibilitySchema, params),
    {
      onSuccess: () => {
        WebClient.instance.response.session.deckVisibilityChanged?.(params);
      },
      onError: (responseCode, _raw, failure) => {
        const target = params.deckId !== undefined ? String(params.deckId) : params.folderPath ?? '';
        WebClient.instance.response.session.commandFailed?.('deckSetVisibility', responseCode, target, failure);
      },
    }
  );
}
