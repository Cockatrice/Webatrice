import { WebSocketConnectReason, type ActivateConnectOptions } from '../../types/ConnectOptions';
import { beginConnect } from './beginConnect';

export function activateAccount(options: Omit<ActivateConnectOptions, 'reason'>): void {
  beginConnect({ ...options, reason: WebSocketConnectReason.ACTIVATE_ACCOUNT });
}
