import { create } from '@bufbuild/protobuf';
import {
  Command_ForgotPasswordChallenge_ext,
  Command_ForgotPasswordChallengeSchema,
  type ForgotPasswordChallengeParams,
} from '../../generated';

import { StatusEnum } from '../../types/StatusEnum';
import { WebClient } from '../../WebClient';
import type { ConnectTarget } from '../../types/WebClientConfig';
import { disconnect, updateStatus } from './';

export function forgotPasswordChallenge(options: ConnectTarget & ForgotPasswordChallengeParams): void {
  const { userName, email } = options;

  WebClient.instance.protobuf.sendSessionCommand(
    Command_ForgotPasswordChallenge_ext,
    create(Command_ForgotPasswordChallengeSchema, {
      ...WebClient.instance.clientConfig,
      userName,
      email,
    }),
    {
      onSuccess: () => {
        updateStatus(StatusEnum.DISCONNECTED, null);
        WebClient.instance.response.session.resetPassword();
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
