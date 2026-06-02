import { create } from '@bufbuild/protobuf';
import { Command_FlipCard_ext, Command_FlipCardSchema, type FlipCardParams } from '../../generated';
import { WebClient } from '../../WebClient';

export function flipCard(gameId: number, params: FlipCardParams, judgeTargetId?: number): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_FlipCard_ext,
    create(Command_FlipCardSchema, params),
    { judgeTargetId },
  );
}
