import { create, getExtension } from '@bufbuild/protobuf';
import type { MessageInitShape } from '@bufbuild/protobuf';
import {
  Command_Register_ext,
  Command_RegisterSchema,
  Response_Register_ext,
  Response_ResponseCode,
  type RegisterParams,
} from '../../generated';

import { StatusEnum } from '../../types/StatusEnum';
import { WebClient } from '../../WebClient';
import type { ConnectTarget } from '../../types/WebClientConfig';
import { login, disconnect, updateStatus } from './';

export function register(options: ConnectTarget & RegisterParams, password?: string): void {
  const { userName, email, country, realName, hashedPassword } = options;

  const params: MessageInitShape<typeof Command_RegisterSchema> = {
    ...WebClient.instance.clientConfig,
    userName,
    email,
    country,
    realName,
    ...(hashedPassword
      ? { hashedPassword }
      : { password }),
  };

  const onRegistrationError = (action: () => void) => {
    action();
    updateStatus(StatusEnum.DISCONNECTED, 'Registration failed');
    disconnect();
  };

  WebClient.instance.protobuf.sendSessionCommand(Command_Register_ext, create(Command_RegisterSchema, params), {
    onResponseCode: {
      [Response_ResponseCode.RespRegistrationAccepted]: () => {
        login({
          host: options.host,
          port: options.port,
          userName: options.userName,
          hashedPassword,
        }, password);
        WebClient.instance.response.session.registrationSuccess();
      },
      [Response_ResponseCode.RespRegistrationAcceptedNeedsActivation]: () => {
        updateStatus(StatusEnum.DISCONNECTED, 'Registration accepted, awaiting activation');
        WebClient.instance.response.session.accountAwaitingActivation({
          host: options.host,
          port: options.port,
          userName: options.userName,
        });
        disconnect();
      },
      [Response_ResponseCode.RespUserAlreadyExists]: () => onRegistrationError(
        () => WebClient.instance.response.session.registrationUserNameError('Username is taken')
      ),
      [Response_ResponseCode.RespUsernameInvalid]: () => onRegistrationError(
        () => WebClient.instance.response.session.registrationUserNameError('Invalid username')
      ),
      [Response_ResponseCode.RespPasswordTooShort]: () => onRegistrationError(
        () => WebClient.instance.response.session.registrationPasswordError('Your password was too short')
      ),
      [Response_ResponseCode.RespEmailRequiredToRegister]: () => onRegistrationError(
        () => WebClient.instance.response.session.registrationRequiresEmail()
      ),
      [Response_ResponseCode.RespEmailBlackListed]: () => onRegistrationError(
        () => WebClient.instance.response.session.registrationEmailError('This email provider has been blocked')
      ),
      [Response_ResponseCode.RespTooManyRequests]: () => onRegistrationError(
        () => WebClient.instance.response.session.registrationEmailError('Max accounts reached for this email')
      ),
      [Response_ResponseCode.RespRegistrationDisabled]: () => onRegistrationError(
        () => WebClient.instance.response.session.registrationFailed('Registration is currently disabled')
      ),
      [Response_ResponseCode.RespUserIsBanned]: (raw) => {
        const register = getExtension(raw, Response_Register_ext);
        onRegistrationError(
          () => WebClient.instance.response.session.registrationFailed(register.deniedReasonStr, Number(register.deniedEndTime))
        );
      },
    },
    onError: () => onRegistrationError(
      () => WebClient.instance.response.session.registrationFailed('Registration failed due to a server issue')
    ),
  });
}
