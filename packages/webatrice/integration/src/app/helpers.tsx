import { ReactElement } from 'react';

import { renderWithProviders } from '../../../src/__test-utils__';
import { store } from '../helpers/setup';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { WebClient } from '@cockatrice/sockatrice';

export function renderAppScreen(ui: ReactElement) {
  return renderWithProviders(
    <WebClientContext.Provider value={WebClient.instance}>
      {ui}
    </WebClientContext.Provider>,
    { store }
  );
}

export { store };
