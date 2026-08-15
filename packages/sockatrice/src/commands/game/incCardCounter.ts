import { create } from '@bufbuild/protobuf';
import { Command_IncCardCounter_ext, Command_IncCardCounterSchema, type IncCardCounterParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function incCardCounter(
  gameId: number,
  params: IncCardCounterParams,
  judgeTargetId?: number,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_IncCardCounter_ext,
    create(Command_IncCardCounterSchema, params),
    { judgeTargetId, ...options },
  );
}
