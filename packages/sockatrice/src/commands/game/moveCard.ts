import { create } from '@bufbuild/protobuf';
import { Command_MoveCard_ext, Command_MoveCardSchema, type MoveCardParams } from '../../generated';
import type { CommandOptionsWithoutResponse } from '../../services/command-options';
import { WebClient } from '../../WebClient';

export function moveCard(
  gameId: number,
  params: MoveCardParams,
  judgeTargetId?: number,
  options?: Omit<CommandOptionsWithoutResponse, 'judgeTargetId'>,
): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_MoveCard_ext,
    create(Command_MoveCardSchema, params),
    { judgeTargetId, ...options },
  );
}
