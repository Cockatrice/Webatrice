import { create } from '@bufbuild/protobuf';
import { Command_AttachCard_ext, Command_AttachCardSchema, type AttachCardParams } from '../../generated';
import { WebClient } from '../../WebClient';

export function attachCard(gameId: number, params: AttachCardParams, judgeTargetId?: number): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_AttachCard_ext,
    create(Command_AttachCardSchema, params),
    { judgeTargetId },
  );
}
