import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { CommandFailure } from '../../types/CommandFailure';

import { Command_AccountPassword_ext, Command_AccountPasswordSchema, type AccountPasswordParams } from '../../generated';
import { generateSalt, hashPassword, passwordHashAvailable } from '../../utils';

export function accountPassword(oldPassword: string, newPassword: string, hashedNewPassword: string): void;
export function accountPassword(
  oldPassword: string,
  newPassword: string,
  onChanged?: () => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): Promise<void>;
export function accountPassword(
  oldPassword: string,
  newPassword: string,
  onChangedOrHashedNewPassword?: (() => void) | string,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): Promise<void> | void {
  if (typeof onChangedOrHashedNewPassword === 'string') {
    sendAccountPassword({
      oldPassword,
      newPassword: newPassword || undefined,
      hashedNewPassword: onChangedOrHashedNewPassword || undefined,
    });
    return;
  }
  return changePassword(oldPassword, newPassword, onChangedOrHashedNewPassword, onFailure);
}

async function changePassword(
  oldPassword: string,
  newPassword: string,
  onChanged?: () => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): Promise<void> {
  const credential = WebClient.instance.serverSupportsPasswordHash && passwordHashAvailable()
    ? { hashedNewPassword: await hashPassword(generateSalt(), newPassword) }
    : { newPassword };

  sendAccountPassword({ oldPassword, ...credential }, onChanged, onFailure);
}

function sendAccountPassword(
  params: AccountPasswordParams,
  onChanged?: () => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void {
  WebClient.instance.protobuf.sendSessionCommand(Command_AccountPassword_ext, create(Command_AccountPasswordSchema, params), {
    onSuccess: () => {
      WebClient.instance.response.session.accountPasswordChange();
      onChanged?.();
    },
    onError: onFailure && ((responseCode, _raw, failure) => onFailure(responseCode, failure)),
  });
}
