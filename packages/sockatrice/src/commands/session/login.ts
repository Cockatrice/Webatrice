import { create } from '@bufbuild/protobuf';
import type { MessageInitShape } from '@bufbuild/protobuf';
import {
  Command_Login_ext,
  Command_LoginSchema,
  Response_Login_ext,
  Response_ResponseCode,
  type LoginParams,
} from '../../generated';

import { CommandFailure } from '../../services/command-options';
import { StatusEnum } from '../../types/StatusEnum';
import { WebClient } from '../../WebClient';
import type { ConnectTarget } from '../../types/WebClientConfig';
import {
  disconnect,
  listUsers,
  listRooms,
  updateStatus,
} from './';

export function login(options: ConnectTarget & LoginParams, password?: string): void {
  const { userName, hashedPassword } = options;

  const { clientConfig } = WebClient.instance;
  const loginConfig: MessageInitShape<typeof Command_LoginSchema> = {
    ...clientConfig,
    clientfeatures: [...clientConfig.clientfeatures],
    clientid: 'webatrice',
    userName,
    ...(hashedPassword
      ? { hashedPassword }
      : { password }),
  };

  const onLoginError = (responseCode: number, message: string, extra?: () => void) => {
    updateStatus(StatusEnum.DISCONNECTED, message);
    extra?.();
    WebClient.instance.response.session.loginFailed(responseCode);
    disconnect();
  };

  const rejectWith = (message: string, extra?: () => void) =>
    (raw: { responseCode: number }) => onLoginError(raw.responseCode, message, extra);

  WebClient.instance.protobuf.sendSessionCommand(Command_Login_ext, create(Command_LoginSchema, loginConfig), {
    responseExt: Response_Login_ext,
    onSuccess: (resp) => {
      const { buddyList, ignoreList, userInfo, missingFeatures } = resp;

      WebClient.instance.response.session.updateBuddyList(buddyList);
      WebClient.instance.response.session.updateIgnoreList(ignoreList);
      WebClient.instance.response.session.updateUser(userInfo);
      WebClient.instance.response.session.loginSuccessful({
        hashedPassword: loginConfig.hashedPassword,
        missingFeatures,
      });

      listUsers();
      listRooms();

      updateStatus(StatusEnum.LOGGED_IN, 'Logged in.');
    },
    onResponseCode: {
      [Response_ResponseCode.RespClientUpdateRequired]: rejectWith('Login failed: missing features'),
      [Response_ResponseCode.RespWrongPassword]: rejectWith('Login failed: incorrect username or password'),
      [Response_ResponseCode.RespUsernameInvalid]: rejectWith('Login failed: incorrect username or password'),
      [Response_ResponseCode.RespWouldOverwriteOldSession]: rejectWith('Login failed: duplicated user session'),
      [Response_ResponseCode.RespUserIsBanned]: rejectWith('Login failed: banned user'),
      [Response_ResponseCode.RespRegistrationRequired]: rejectWith('Login failed: registration required'),
      [Response_ResponseCode.RespClientIdRequired]: rejectWith('Login failed: missing client ID'),
      [Response_ResponseCode.RespContextError]: rejectWith('Login failed: server error'),
      [Response_ResponseCode.RespPasswordChangeRequired]: rejectWith('Login failed: password change required'),
      [Response_ResponseCode.RespServerFull]: rejectWith('Login failed: server is full'),
      [Response_ResponseCode.RespAccountNotActivated]: rejectWith('Login failed: account not activated',
        () => {
          WebClient.instance.response.session.accountAwaitingActivation({
            host: options.host,
            port: options.port,
            userName: options.userName,
          });
        }
      ),
    },
    onError: (responseCode, _raw, failure) => {
      if (failure === CommandFailure.Disconnected) {
        WebClient.instance.response.session.loginFailed(responseCode);
        return;
      }
      onLoginError(responseCode, failure === CommandFailure.Timeout
        ? 'Login failed: the server did not respond'
        : `Login failed: unknown error: ${responseCode}`);
    },
  });
}
