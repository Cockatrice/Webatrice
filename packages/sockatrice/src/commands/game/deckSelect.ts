import { create } from '@bufbuild/protobuf';
import {
  Command_DeckSelect_ext,
  Command_DeckSelectSchema,
  Response_DeckDownload_ext,
  type DeckSelectParams,
} from '../../generated';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

export function deckSelect(gameId: number, params: DeckSelectParams, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_DeckSelect_ext,
    create(Command_DeckSelectSchema, params),
    {
      responseExt: Response_DeckDownload_ext,
      onSuccess: (resp) => WebClient.instance.response.game.deckSelected?.(gameId, resp.deck, ...correlation),
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.game.deckSelectFailed?.(gameId, responseCode, failure, ...correlation);
      },
    },
  );
}
