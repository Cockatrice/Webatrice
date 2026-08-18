import { create } from '@bufbuild/protobuf';
import { Command_IncCounter_ext, Command_IncCounterSchema, type IncCounterParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function incCounter(
  gameId: number,
  params: IncCounterParams,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_IncCounter_ext,
    create(Command_IncCounterSchema, params),
    options,
  );
}
