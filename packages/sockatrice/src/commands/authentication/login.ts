import { WebSocketConnectReason, type LoginConnectOptions } from '../../types/ConnectOptions';
import { beginConnect } from './beginConnect';

export function login(options: Omit<LoginConnectOptions, 'reason'>): void {
  beginConnect({ ...options, reason: WebSocketConnectReason.LOGIN });
}
