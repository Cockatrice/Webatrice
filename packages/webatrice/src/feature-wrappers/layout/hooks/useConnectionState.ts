import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

export type ConnectionState = 'connected' | 'stale' | 'disconnected';

export const CONNECTION_KEYS: Record<ConnectionState, string> = {
  connected: 'TopBar.connection.connected',
  stale: 'TopBar.connection.stale',
  disconnected: 'TopBar.connection.disconnected',
};

export function useConnectionState(): ConnectionState {
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const isServerUnresponsive = useAppSelector(server.Selectors.getIsServerUnresponsive);
  return !isConnected ? 'disconnected' : isServerUnresponsive ? 'stale' : 'connected';
}
