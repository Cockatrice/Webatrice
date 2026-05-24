import { WebSocketConnectReason, type PasswordResetChallengeConnectOptions } from '../../types/ConnectOptions';
import { beginConnect } from './beginConnect';

export function resetPasswordChallenge(options: Omit<PasswordResetChallengeConnectOptions, 'reason'>): void {
  beginConnect({ ...options, reason: WebSocketConnectReason.PASSWORD_RESET_CHALLENGE });
}
