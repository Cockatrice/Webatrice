import { create } from '@bufbuild/protobuf';
import { Command_SetCardCounter_ext, Command_SetCardCounterSchema, type SetCardCounterParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function setCardCounter(
  gameId: number,
  params: SetCardCounterParams,
  judgeTargetId?: number,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_SetCardCounter_ext,
    create(Command_SetCardCounterSchema, params),
    { judgeTargetId, ...options },
  );
}
