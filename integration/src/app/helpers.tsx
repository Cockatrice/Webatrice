import { ReactElement } from 'react';

import { renderWithProviders } from '../../../src/__test-utils__';
import { store } from '@app/store';
import { WebClientContext } from '@app/hooks';
import { WebClient } from '@app/websocket';

// @critical Use the real @app/store, not renderWithProviders' default — the WebClient dispatches against the production store. WebClientContext is provided directly because setup.ts already constructs the singleton.
export function renderAppScreen(ui: ReactElement) {
  return renderWithProviders(
    <WebClientContext.Provider value={WebClient.instance}>
      {ui}
    </WebClientContext.Provider>,
    { store }
  );
}

export { store };
