import { create } from '@bufbuild/protobuf';
import type { MessageInitShape } from '@bufbuild/protobuf';
import {
  Command_ForgotPasswordReset_ext,
  Command_ForgotPasswordResetSchema,
  type ForgotPasswordResetParams,
} from '../../generated';

import { StatusEnum } from '../../types/StatusEnum';
import { WebClient } from '../../WebClient';
import type { ConnectTarget } from '../../types/WebClientConfig';
import { disconnect, updateStatus } from '.';

export function forgotPasswordReset(
  options: ConnectTarget & ForgotPasswordResetParams,
  newPassword?: string,
): void {
  const { userName, token, hashedNewPassword } = options;

  const params: MessageInitShape<typeof Command_ForgotPasswordResetSchema> = {
    ...WebClient.instance.clientConfig,
    userName,
    token,
    ...(hashedNewPassword
      ? { hashedNewPassword }
      : { newPassword }),
  };

  WebClient.instance.protobuf.sendSessionCommand(
    Command_ForgotPasswordReset_ext,
    create(Command_ForgotPasswordResetSchema, params),
    {
      onSuccess: () => {
        updateStatus(StatusEnum.DISCONNECTED, null);
        WebClient.instance.response.session.resetPasswordSuccess();
        disconnect();
      },
      onError: () => {
        updateStatus(StatusEnum.DISCONNECTED, null);
        WebClient.instance.response.session.resetPasswordFailed();
        disconnect();
      },
    }
  );
}
