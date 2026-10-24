import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import { Command_DeckListOtherUser_ext, Command_DeckListOtherUserSchema, Response_DeckList_ext } from '../../generated';

export function deckListOtherUser(userName: string): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_DeckListOtherUser_ext,
    create(Command_DeckListOtherUserSchema, { userName }),
    {
      responseExt: Response_DeckList_ext,
      onSuccess: (response) => {
        WebClient.instance.response.session.otherUserDecks?.(userName, response);
      },
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.session.commandFailed?.('deckListOtherUser', responseCode, userName, failure);
      },
    }
  );
}
