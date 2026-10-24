import { create } from '@bufbuild/protobuf';
import {
  Command_MoveCard_ext,
  Command_MoveCardSchema,
  Command_Shuffle_ext,
  Command_ShuffleSchema,
  type MoveCardParams,
  type ShuffleParams,
} from '../../generated';
import { WebClient } from '../../WebClient';

export function moveCardAndShuffle(gameId: number, move: MoveCardParams, shuffle: ShuffleParams): void {
  WebClient.instance.protobuf.sendGameCommands(gameId, [
    { ext: Command_Shuffle_ext, value: create(Command_ShuffleSchema, shuffle) },
    { ext: Command_MoveCard_ext, value: create(Command_MoveCardSchema, move) },
  ]);
}
