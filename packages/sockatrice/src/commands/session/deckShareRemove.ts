import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_DeckShareRemove_ext, Command_DeckShareRemoveSchema } from '../../generated';

export function deckShareRemove(shareId: number): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_DeckShareRemove_ext, create(Command_DeckShareRemoveSchema, { shareId }), {
    onSuccess: () => {
      WebClient.instance.response.session.deckShareRemoved?.(shareId);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.session.commandFailed?.('deckShareRemove', responseCode, String(shareId), failure);
    },
  });
}
