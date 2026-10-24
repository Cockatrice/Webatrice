import { create } from '@bufbuild/protobuf';
import type { CommandFailure } from '../../types/CommandFailure';
import { WebClient } from '../../WebClient';
import { Command_ReplaySubmitCode_ext, Command_ReplaySubmitCodeSchema } from '../../generated';

export function replaySubmitCode(
  replayCode: string,
  onSubmitted?: () => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(
    Command_ReplaySubmitCode_ext,
    create(Command_ReplaySubmitCodeSchema, { replayCode }),
    {
      onSuccess: onSubmitted,
      onError: (responseCode, _raw, failure) => onFailure?.(responseCode, failure),
    }
  );
}
