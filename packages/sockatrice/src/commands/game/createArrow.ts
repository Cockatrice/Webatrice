import { create } from '@bufbuild/protobuf';
import { Command_CreateArrow_ext, Command_CreateArrowSchema, type CreateArrowParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function createArrow(
  gameId: number,
  params: CreateArrowParams,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_CreateArrow_ext,
    create(Command_CreateArrowSchema, params),
    options,
  );
}
