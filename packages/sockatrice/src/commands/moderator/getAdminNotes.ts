import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { RequestId } from '../../types/RequestId';

import { Command_GetAdminNotes_ext, Command_GetAdminNotesSchema, Response_GetAdminNotes_ext } from '../../generated';

export function getAdminNotes(userName: string, ...correlation: [requestId?: RequestId]): void {
  WebClient.instance.protobuf.sendModeratorCommand(Command_GetAdminNotes_ext, create(Command_GetAdminNotesSchema, { userName }), {
    responseExt: Response_GetAdminNotes_ext,
    onSuccess: (response) => {
      WebClient.instance.response.moderator.getAdminNotes(userName, response.notes, ...correlation);
    },
    onError: (responseCode, _raw, failure) => {
      WebClient.instance.response.moderator.commandFailed?.('getAdminNotes', responseCode, userName, failure, ...correlation);
    },
  });
}
