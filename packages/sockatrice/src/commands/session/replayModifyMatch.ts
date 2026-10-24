import { create } from '@bufbuild/protobuf';
import type { CommandFailure } from '../../types/CommandFailure';
import { WebClient } from '../../WebClient';

import { Command_ReplayModifyMatch_ext, Command_ReplayModifyMatchSchema } from '../../generated';

export function replayModifyMatch(
  gameId: number,
  doNotHide: boolean,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_ReplayModifyMatch_ext,
    create(Command_ReplayModifyMatchSchema, { gameId, doNotHide }),
    {
      onSuccess: () => {
        WebClient.instance.response.session.replayModifyMatch(gameId, doNotHide);
      },
      onError: (responseCode, _raw, failure) => onFailure?.(responseCode, failure),
    }
  );
}
