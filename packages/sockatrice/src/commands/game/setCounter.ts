import { create } from '@bufbuild/protobuf';
import { Command_SetCounter_ext, Command_SetCounterSchema, type SetCounterParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function setCounter(
  gameId: number,
  params: SetCounterParams,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_SetCounter_ext,
    create(Command_SetCounterSchema, params),
    options,
  );
}
