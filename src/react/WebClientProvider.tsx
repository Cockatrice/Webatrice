import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'react-redux';
import { WebClient } from '@cockatrice/sockatrice';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { attachResponseHandlers } from '../api';

export const WebClientContext = createContext<WebClient | null>(null);
WebClientContext.displayName = 'WebClientContext';

export interface WebClientProviderProps {
  config: WebsocketTypes.ClientConfig;
  options: WebsocketTypes.ClientOptions;
  // Optional override. If supplied, skip internal construction and surface
  // this client directly via context — used by tests to inject mocks.
  client?: WebClient;
  children: ReactNode;
}

export function WebClientProvider({ config, options, client: clientOverride, children }: WebClientProviderProps) {
  const store = useStore();
  const [client] = useState(() => clientOverride ?? new WebClient(
    attachResponseHandlers(store),
    config,
    options,
  ));

  return <WebClientContext value={client}>{children}</WebClientContext>;
}

export function useWebClient(): WebClient {
  const client = useContext(WebClientContext);
  if (!client) {
    throw new Error('useWebClient must be used within a WebClientProvider');
  }
  return client;
}
