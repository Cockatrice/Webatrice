import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

export const CLIENT_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: true,
  keepalive: 5000,
};
