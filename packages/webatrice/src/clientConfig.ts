import { SOCKATRICE_FEATURES } from '@cockatrice/sockatrice';

import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

export { CLIENT_OPTIONS } from './clientOptions';

const APP_FEATURES = [
  '2.7.0_min_version',
  '2.8.0_min_version',
] as const;

export function formatClientVersion(version: string, buildDate: string): string {
  return `webatrice-${version} (${buildDate})`;
}

export const CLIENT_VERSION = formatClientVersion(__WEBATRICE_VERSION__, __WEBATRICE_BUILD_DATE__);

export const CLIENT_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'webatrice',
  clientver: CLIENT_VERSION,
  clientfeatures: [...SOCKATRICE_FEATURES, ...APP_FEATURES],
};
