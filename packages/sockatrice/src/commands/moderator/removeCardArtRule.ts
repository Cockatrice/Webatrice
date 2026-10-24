import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_RemoveCardArtRule_ext, Command_RemoveCardArtRuleSchema } from '../../generated';

export function removeCardArtRule(cardName: string, cardProviderId: string): void {
  WebClient.instance.protobuf.sendModeratorCommand(
    Command_RemoveCardArtRule_ext,
    create(Command_RemoveCardArtRuleSchema, { cardName, cardProviderId }),
    {
      onSuccess: () => {
        WebClient.instance.response.moderator.cardArtRuleRemoved?.(cardName, cardProviderId);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.moderator.commandFailed?.('removeCardArtRule', responseCode, cardName, failure);
      },
    },
  );
}
