import { WebSocketConnectReason, type PasswordResetConnectOptions } from '../../types/ConnectOptions';
import { beginConnect } from './beginConnect';

export function resetPassword(options: Omit<PasswordResetConnectOptions, 'reason'>): void {
  beginConnect({ ...options, reason: WebSocketConnectReason.PASSWORD_RESET });
}
