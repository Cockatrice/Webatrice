import { setPendingOptions } from '../../utils/connectionState';
import { WebClient } from '../../WebClient';
import { StatusEnum } from '../../types/StatusEnum';
import type { WebSocketConnectOptions } from '../../types/ConnectOptions';
import { updateStatus } from '../session';

const CONNECTING_STATUS_LABEL = 'Connecting...';

export function beginConnect(options: WebSocketConnectOptions): void {
  setPendingOptions(options);
  updateStatus(StatusEnum.CONNECTING, CONNECTING_STATUS_LABEL);
  WebClient.instance.connect({ host: options.host, port: options.port });
}
