import { WebClient } from '../../WebClient';
import type { TestConnectionOptions } from '../../types/ConnectOptions';

export function testConnection(options: Omit<TestConnectionOptions, 'reason'>): void {
  WebClient.instance.testConnect({ host: options.host, port: options.port });
}
