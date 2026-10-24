import { create } from '@bufbuild/protobuf';
import { Command_NextTurn_ext, Command_NextTurnSchema } from '../../generated';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

export function nextTurn(gameId: number, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_NextTurn_ext,
    create(Command_NextTurnSchema),
    {
      onSuccess: () => WebClient.instance.response.game.nextTurnAnswered?.(gameId, ...correlation),
      onError: (responseCode, _raw, failure) => {
        WebClient.instance.response.game.nextTurnFailed?.(gameId, responseCode, failure, ...correlation);
      },
    },
  );
}
