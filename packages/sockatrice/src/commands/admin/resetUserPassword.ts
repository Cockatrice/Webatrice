import { create } from '@bufbuild/protobuf';
import { Command_ResetUserPassword_ext, Command_ResetUserPasswordSchema, Response_ResetUserPassword_ext } from '../../generated';
import type { CommandFailure } from '../../types/CommandFailure';
import { WebClient } from '../../WebClient';

export function resetUserPassword(
  userName: string,
  onReset?: (userName: string, temporaryPassword: string) => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void {
  WebClient.instance.protobuf.sendAdminCommand(
    Command_ResetUserPassword_ext,
    create(Command_ResetUserPasswordSchema, { userName }),
    {
      responseExt: Response_ResetUserPassword_ext,
      onSuccess: (response) => {
        onReset?.(response.userName || userName, response.temporaryPassword);
      },
      onError: (responseCode, _raw, failure) => onFailure?.(responseCode, failure),
    }
  );
}
