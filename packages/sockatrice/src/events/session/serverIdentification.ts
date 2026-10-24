import type { Event_ServerIdentification } from '../../generated';
import { WebClient } from '../../WebClient';
import { StatusEnum } from '../../types/StatusEnum';
import { consumePendingOptions } from '../../utils/connectionState';
import { WebSocketConnectReason } from '../../types/ConnectOptions';
import { generateSalt, hashPassword, passwordHashAvailable, passwordSaltSupported } from '../../utils';
import * as SessionCommands from '../../commands/session';
import { CommandFailure } from '../../types/CommandFailure';

function onSaltFailure(settle: (failure?: CommandFailure) => void) {
  return (failure?: CommandFailure) => {
    settle(failure);
    if (failure !== CommandFailure.Disconnected) {
      SessionCommands.disconnect();
    }
  };
}

export async function serverIdentification(info: Event_ServerIdentification): Promise<void> {
  const { serverName, serverVersion, protocolVersion, serverOptions } = info;
  const response = WebClient.instance.response;

  if (protocolVersion !== WebClient.instance.protocolVersion) {
    SessionCommands.updateStatus(StatusEnum.DISCONNECTED, `Protocol version mismatch: ${protocolVersion}`);
    SessionCommands.disconnect();
    return;
  }

  const serverSupportsPasswordHash = passwordSaltSupported(serverOptions);
  WebClient.instance.serverSupportsPasswordHash = serverSupportsPasswordHash;
  const getPasswordSalt = serverSupportsPasswordHash && passwordHashAvailable();
  const options = consumePendingOptions();

  if (!options) {
    SessionCommands.updateStatus(StatusEnum.DISCONNECTED, 'Connection lost — please log in again');
    SessionCommands.disconnect();
    return;
  }

  switch (options.reason) {
    case WebSocketConnectReason.LOGIN: {
      const { password, ...rest } = options;
      SessionCommands.updateStatus(StatusEnum.LOGGING_IN, 'Logging In...');
      if (getPasswordSalt) {
        SessionCommands.requestPasswordSalt(rest,
          // Empty salt → fall through to plain password.
          // See .github/instructions/sockatrice.instructions.md#protocol-version-and-feature-flags.
          async (salt) => {
            if (salt) {
              const hashedPassword = rest.hashedPassword || await hashPassword(salt, password);
              SessionCommands.login({ ...rest, hashedPassword }, password);
            } else {
              SessionCommands.login(rest, password);
            }
          },
          onSaltFailure(() => response.session.loginFailed()),
        );
      } else {
        SessionCommands.login(rest, password);
      }
      break;
    }
    case WebSocketConnectReason.REGISTER: {
      const { password, ...rest } = options;
      if (getPasswordSalt) {
        const passwordSalt = generateSalt();
        const hashedPassword = await hashPassword(passwordSalt, password);
        SessionCommands.register({ ...rest, hashedPassword }, password);
      } else {
        SessionCommands.register(rest, password);
      }
      break;
    }
    case WebSocketConnectReason.ACTIVATE_ACCOUNT: {
      const { password, ...rest } = options;
      if (getPasswordSalt) {
        SessionCommands.requestPasswordSalt(rest,
          async (salt) => {
            const hashedPassword = salt ? await hashPassword(salt, password) : undefined;
            SessionCommands.activate(rest, password, hashedPassword);
          },
          onSaltFailure((failure) => response.session.accountActivationFailed(failure)),
        );
      } else {
        SessionCommands.activate(rest, password);
      }
      break;
    }
    case WebSocketConnectReason.PASSWORD_RESET_REQUEST:
      SessionCommands.forgotPasswordRequest(options);
      break;
    case WebSocketConnectReason.PASSWORD_RESET_CHALLENGE:
      SessionCommands.forgotPasswordChallenge(options);
      break;
    case WebSocketConnectReason.PASSWORD_RESET: {
      const { newPassword, ...rest } = options;
      if (getPasswordSalt) {
        SessionCommands.requestPasswordSalt(rest,
          async (salt) => {
            if (salt) {
              const hashedNewPassword = await hashPassword(salt, newPassword);
              SessionCommands.forgotPasswordReset({ ...rest, hashedNewPassword }, newPassword);
            } else {
              SessionCommands.forgotPasswordReset(rest, newPassword);
            }
          },
          onSaltFailure(() => response.session.resetPasswordFailed()),
        );
      } else {
        SessionCommands.forgotPasswordReset(rest, newPassword);
      }
      break;
    }
    default: {
      SessionCommands.updateStatus(StatusEnum.DISCONNECTED, `Unknown Connection Reason: ${(options as { reason: number }).reason}`);
      SessionCommands.disconnect();
      break;
    }
  }

  response.session.updateInfo(serverName, serverVersion, serverSupportsPasswordHash);
}
