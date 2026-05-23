import { create } from '@bufbuild/protobuf';
import {
  Command_ForgotPasswordRequest_ext,
  Command_ForgotPasswordRequestSchema,
  Response_ForgotPasswordRequest_ext,
  type ForgotPasswordRequestParams,
} from '../../generated';

import { StatusEnum } from '../../types/StatusEnum';
import { WebClient } from '../../WebClient';
import type { ConnectTarget } from '../../types/WebClientConfig';
import { disconnect, updateStatus } from './';

export function forgotPasswordRequest(options: ConnectTarget & ForgotPasswordRequestParams): void {
  const { userName } = options;

  WebClient.instance.protobuf.sendSessionCommand(Command_ForgotPasswordRequest_ext, create(Command_ForgotPasswordRequestSchema, {
    ...WebClient.instance.clientConfig,
    userName,
  }), {
    responseExt: Response_ForgotPasswordRequest_ext,
    onSuccess: (resp) => {
      if (resp?.challengeEmail) {
        updateStatus(StatusEnum.DISCONNECTED, null);
        WebClient.instance.response.session.resetPasswordChallenge();
      } else {
        updateStatus(StatusEnum.DISCONNECTED, null);
        WebClient.instance.response.session.resetPassword();
      }
      disconnect();
    },
    onError: () => {
      updateStatus(StatusEnum.DISCONNECTED, null);
      WebClient.instance.response.session.resetPasswordFailed();
      disconnect();
    },
  });
}
