import { create } from '@bufbuild/protobuf';
import { WebClient } from '../../WebClient';
import type { CommandFailure } from '../../types/CommandFailure';

import { Command_AccountEdit_ext, Command_AccountEditSchema, type AccountEditParams } from '../../generated';

export function accountEdit(passwordCheck: string, realName?: string, email?: string, country?: string): void;
export function accountEdit(
  params: AccountEditParams,
  onEdited?: () => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void;
export function accountEdit(
  paramsOrPasswordCheck: AccountEditParams | string,
  ...rest: unknown[]
): void {
  if (typeof paramsOrPasswordCheck === 'string') {
    const [realName, email, country] = rest as (string | undefined)[];
    sendAccountEdit({ passwordCheck: paramsOrPasswordCheck || undefined, realName, email, country });
    return;
  }
  const [onEdited, onFailure] = rest as [(() => void)?, ((responseCode: number, failure?: CommandFailure) => void)?];
  sendAccountEdit(paramsOrPasswordCheck, onEdited, onFailure);
}

function sendAccountEdit(
  params: AccountEditParams,
  onEdited?: () => void,
  onFailure?: (responseCode: number, failure?: CommandFailure) => void,
): void {
  const { realName, email, country } = params;
  WebClient.instance.protobuf.sendSessionCommand(Command_AccountEdit_ext, create(Command_AccountEditSchema, params), {
    onSuccess: () => {
      WebClient.instance.response.session.accountEditChanged(realName, email, country);
      onEdited?.();
    },
    onError: onFailure && ((responseCode, _raw, failure) => onFailure(responseCode, failure)),
  });
}
