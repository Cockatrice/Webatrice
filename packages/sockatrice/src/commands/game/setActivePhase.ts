import { create } from '@bufbuild/protobuf';
import { Command_SetActivePhase_ext, Command_SetActivePhaseSchema, type SetActivePhaseParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function setActivePhase(
  gameId: number,
  params: SetActivePhaseParams,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_SetActivePhase_ext,
    create(Command_SetActivePhaseSchema, params),
    options,
  );
}
