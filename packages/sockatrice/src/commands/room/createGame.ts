import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_CreateGame_ext, Command_CreateGameSchema } from '../../generated';
import type { CreateGameParams } from '../../generated';

export function createGame(roomId: number, gameConfig: CreateGameParams): void {
  WebClient.instance.protobuf.sendRoomCommand(roomId, Command_CreateGame_ext, create(Command_CreateGameSchema, gameConfig), {
    onSuccess: () => {
      WebClient.instance.response.room.gameCreated(roomId);
    },
  });
}
