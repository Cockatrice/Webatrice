import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_DeckShareListMine_ext, Command_DeckShareListMineSchema, Response_DeckShareListMine_ext } from '../../generated';

export function deckShareListMine(): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_DeckShareListMine_ext, create(Command_DeckShareListMineSchema), {
    responseExt: Response_DeckShareListMine_ext,
    onSuccess: (response) => {
      WebClient.instance.response.session.deckSharesMine?.(response.shares);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.session.commandFailed?.('deckShareListMine', responseCode, '', failure);
    },
  });
}
