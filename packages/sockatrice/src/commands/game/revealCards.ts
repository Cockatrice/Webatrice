import { create } from '@bufbuild/protobuf';
import { Command_RevealCards_ext, Command_RevealCardsSchema, type RevealCardsParams } from '../../generated';
import { WebClient } from '../../WebClient';

export function revealCards(gameId: number, params: RevealCardsParams, judgeTargetId?: number): void {
  WebClient.instance.protobuf.sendGameCommand(
    gameId,
    Command_RevealCards_ext,
    create(Command_RevealCardsSchema, params),
    { judgeTargetId },
  );
}
