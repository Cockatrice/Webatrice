import { create } from '@bufbuild/protobuf';
import {
  Command_Activate_ext,
  Command_ActivateSchema,
  Response_ResponseCode,
  type ActivateParams,
} from '../../generated';

import { StatusEnum } from '../../types/StatusEnum';
import { WebClient } from '../../WebClient';
import type { ConnectTarget } from '../../types/WebClientConfig';
import { disconnect, login, updateStatus } from './';

export function activate(options: ConnectTarget & ActivateParams, password?: string, hashedPassword?: string): void {
  const { userName, token } = options;

  WebClient.instance.protobuf.sendSessionCommand(Command_Activate_ext, create(Command_ActivateSchema, {
    ...WebClient.instance.clientConfig,
    userName,
    token,
  }), {
    onResponseCode: {
      [Response_ResponseCode.RespActivationAccepted]: () => {
        WebClient.instance.response.session.accountActivationSuccess();
        login({
          host: options.host,
          port: options.port,
          userName: options.userName,
          hashedPassword,
        }, password);
      },
    },
    onError: () => {
      updateStatus(StatusEnum.DISCONNECTED, 'Account Activation Failed');
      disconnect();
      WebClient.instance.response.session.accountActivationFailed();
    },
  });
}
