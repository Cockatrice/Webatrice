import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_DeckShareList_ext, Command_DeckShareListSchema, Response_DeckShareList_ext } from '../../generated';

export function deckShareList(token: string): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_DeckShareList_ext, create(Command_DeckShareListSchema, { token }), {
    responseExt: Response_DeckShareList_ext,
    onSuccess: (response) => {
      WebClient.instance.response.session.deckShareListed?.(token, response);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.session.commandFailed?.('deckShareList', responseCode, token, failure);
    },
  });
}
