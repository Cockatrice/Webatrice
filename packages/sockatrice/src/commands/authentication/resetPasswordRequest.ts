import { WebSocketConnectReason, type PasswordResetRequestConnectOptions } from '../../types/ConnectOptions';
import { beginConnect } from './beginConnect';

export function resetPasswordRequest(options: Omit<PasswordResetRequestConnectOptions, 'reason'>): void {
  beginConnect({ ...options, reason: WebSocketConnectReason.PASSWORD_RESET_REQUEST });
}
