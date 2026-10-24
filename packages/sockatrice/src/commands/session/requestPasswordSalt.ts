import { create } from '@bufbuild/protobuf';
import {
  Command_RequestPasswordSalt_ext,
  Command_RequestPasswordSaltSchema,
  Response_PasswordSalt_ext,
  Response_ResponseCode,
  type RequestPasswordSaltParams,
} from '../../generated';

import { CommandFailure } from '../../services/command-options';
import { StatusEnum } from '../../types/StatusEnum';
import { WebClient } from '../../WebClient';
import type { ConnectTarget } from '../../types/WebClientConfig';
import { updateStatus } from './';

export function requestPasswordSalt(
  options: ConnectTarget & RequestPasswordSaltParams,
  onSaltReceived: (passwordSalt: string) => void,
  onFailure: (failure?: CommandFailure) => void,
): void {
  const { userName } = options;

  WebClient.instance.protobuf.sendSessionCommand(Command_RequestPasswordSalt_ext, create(Command_RequestPasswordSaltSchema, {
    ...WebClient.instance.clientConfig,
    userName,
  }), {
    responseExt: Response_PasswordSalt_ext,
    onSuccess: (resp) => {
      onSaltReceived(resp?.passwordSalt);
    },
    onResponseCode: {
      [Response_ResponseCode.RespRegistrationRequired]: () => {
        updateStatus(StatusEnum.DISCONNECTED, 'Login failed: registration required');
        onFailure();
      },
    },
    onError: (_responseCode, _raw, failure) => {
      if (failure !== CommandFailure.Disconnected) {
        updateStatus(StatusEnum.DISCONNECTED, failure === CommandFailure.Timeout
          ? 'Login failed: the server did not respond'
          : 'Login failed: Unknown Reason');
      }
      onFailure(failure);
    },
  });
}
