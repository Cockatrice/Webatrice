import { create } from '@bufbuild/protobuf';
import { Command_ReverseTurn_ext, Command_ReverseTurnSchema } from '../../generated';
import { WebClient } from '../../WebClient';

export function reverseTurn(gameId: number): void {
  WebClient.instance.protobuf.sendGameCommand(gameId, Command_ReverseTurn_ext, create(Command_ReverseTurnSchema));
}
