import { ReactElement } from 'react';

import { renderWithProviders } from '../../../src/__test-utils__';
import { store } from '../helpers/setup';
import { WebClientContext } from 'datatrice/react';
import { WebClient } from 'sockatrice';

// @critical Pass setup.ts's store, not renderWithProviders' default — the WebClient dispatches against this exact instance. WebClientContext is wired directly because setup.ts already constructs the WebClient singleton.
export function renderAppScreen(ui: ReactElement) {
  return renderWithProviders(
    <WebClientContext.Provider value={WebClient.instance}>
      {ui}
    </WebClientContext.Provider>,
    { store }
  );
}

export { store };
