import type { Event_ServerIdentification } from '../../generated';
import { WebClient } from '../../WebClient';
import { StatusEnum } from '../../types/StatusEnum';
import { consumePendingOptions } from '../../utils/connectionState';
import { WebSocketConnectReason } from '../../types/ConnectOptions';
import { generateSalt, hashPassword, passwordSaltSupported } from '../../utils';
import * as SessionCommands from '../../commands/session';

export async function serverIdentification(info: Event_ServerIdentification): Promise<void> {
  const { serverName, serverVersion, protocolVersion, serverOptions } = info;
  const response = WebClient.instance.response;

  if (protocolVersion !== WebClient.instance.protocolVersion) {
    SessionCommands.updateStatus(StatusEnum.DISCONNECTED, `Protocol version mismatch: ${protocolVersion}`);
    SessionCommands.disconnect();
    return;
  }

  const getPasswordSalt = passwordSaltSupported(serverOptions);
  const options = consumePendingOptions();

  if (!options) {
    SessionCommands.updateStatus(StatusEnum.DISCONNECTED, 'Missing connection options');
    SessionCommands.disconnect();
    return;
  }

  switch (options.reason) {
    case WebSocketConnectReason.LOGIN: {
      const { password, ...rest } = options;
      SessionCommands.updateStatus(StatusEnum.LOGGING_IN, 'Logging In...');
      if (getPasswordSalt) {
        SessionCommands.requestPasswordSalt(rest,
          // Empty salt means the server advertised SupportsPasswordHash but
          // can't actually produce one. Treat it as effectively unsupported —
          // fall through to a plain-password login rather than failing.
          async (salt) => {
            if (salt) {
              const hashedPassword = rest.hashedPassword || await hashPassword(salt, password);
              SessionCommands.login({ ...rest, hashedPassword }, password);
            } else {
              SessionCommands.login(rest, password);
            }
          },
          () => {
            response.session.loginFailed(); SessionCommands.disconnect();
          },
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
          () => {
            response.session.accountActivationFailed(); SessionCommands.disconnect();
          },
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
          () => {
            response.session.resetPasswordFailed(); SessionCommands.disconnect();
          },
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

  response.session.updateInfo(serverName, serverVersion);
}
