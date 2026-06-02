import { create } from '@bufbuild/protobuf';
import { Command_MoveCard_ext, Command_MoveCardSchema, type MoveCardParams } from '../../generated';
import { WebClient } from '../../WebClient';

export function moveCard(gameId: number, params: MoveCardParams, judgeTargetId?: number): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_MoveCard_ext,
    create(Command_MoveCardSchema, params),
    { judgeTargetId },
  );
}
