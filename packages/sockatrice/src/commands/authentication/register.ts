import { WebSocketConnectReason, type RegisterConnectOptions } from '../../types/ConnectOptions';
import { beginConnect } from './beginConnect';

export function register(options: Omit<RegisterConnectOptions, 'reason'>): void {
  beginConnect({ ...options, reason: WebSocketConnectReason.REGISTER });
}
