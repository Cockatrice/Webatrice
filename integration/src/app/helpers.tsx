import { ReactElement } from 'react';

import { renderWithProviders } from '../../../src/__test-utils__';
import { store } from '../helpers/setup';
import { WebClientContext } from '@app/hooks';
import { WebClient } from 'sockatrice';

// @critical Use the real @app/store, not renderWithProviders' default â€” the WebClient dispatches against the production store. WebClientContext is provided directly because setup.ts already constructs the singleton.
export function renderAppScreen(ui: ReactElement) {
  return renderWithProviders(
    <WebClientContext.Provider value={WebClient.instance}>
      {ui}
    </WebClientContext.Provider>,
    { store }
  );
}

export { store };
