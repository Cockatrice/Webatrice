import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';

import { Command_GetGamesOfUser_ext, Command_GetGamesOfUserSchema, Response_GetGamesOfUser_ext } from '../../generated';
import { outlivedSession } from '../outlivedSession';

export function getGamesOfUser(userName: string): void {
  WebClient.instance.response.session.getGamesOfUserPending?.(userName);

  WebClient.instance.protobuf.sendSessionCommand(Command_GetGamesOfUser_ext, create(Command_GetGamesOfUserSchema, { userName }), {
    responseExt: Response_GetGamesOfUser_ext,
    onSuccess: (gamesOfUser) => {
      WebClient.instance.response.session.getGamesOfUser(userName, gamesOfUser);
    },
    onError: (responseCode, _raw, failure) => {
      if (!outlivedSession(failure)) {
        WebClient.instance.response.session.getGamesOfUserFailed?.(userName, responseCode, failure);
      }
    },
  });
}
