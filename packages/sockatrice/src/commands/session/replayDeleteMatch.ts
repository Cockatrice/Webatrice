import { create } from '@bufbuild/protobuf';
import type { CommandFailure } from '../../types/CommandFailure';
import { WebClient } from '../../WebClient';

import { Command_ReplayDeleteMatch_ext, Command_ReplayDeleteMatchSchema } from '../../generated';

export function replayDeleteMatch(gameId: number, onFailure?: (responseCode: number, failure?: CommandFailure) => void): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_ReplayDeleteMatch_ext,
    create(Command_ReplayDeleteMatchSchema, { gameId }),
    {
      onSuccess: () => {
        WebClient.instance.response.session.replayDeleteMatch(gameId);
      },
      onError: (responseCode, _raw, failure) => onFailure?.(responseCode, failure),
    }
  );
}
