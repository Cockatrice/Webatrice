import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_ListCardArtRules_ext, Command_ListCardArtRulesSchema, Response_ListCardArtRules_ext } from '../../generated';

export function listCardArtRules(): void {
  WebClient.instance.protobuf.sendModeratorCommand(Command_ListCardArtRules_ext, create(Command_ListCardArtRulesSchema), {
    responseExt: Response_ListCardArtRules_ext,
    onSuccess: (response) => {
      WebClient.instance.response.moderator.cardArtRules?.(response.entries);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.('listCardArtRules', responseCode, '', failure);
    },
  });
}
