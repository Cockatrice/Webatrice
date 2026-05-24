import { ReactElement } from 'react';

import { renderWithProviders } from '../../../src/__test-utils__';
import { WebClientContext } from '@cockatrice/datatrice/react';
import { WebClient } from '@cockatrice/sockatrice';
import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { store } from '../helpers/setup';

// Like ../app/helpers.tsx, but accepts an optional `route` so feature specs
// that depend on `useParams` (Player, Room) can drive react-router-dom.
export function renderFeatureScreen(ui: ReactElement, route = '/') {
  return renderWithProviders(
    <WebClientContext.Provider value={WebClient.instance}>
      {ui}
    </WebClientContext.Provider>,
    { store, route },
  );
}

// Set the integration store into a "logged-in" shape — enough for AuthGuard
// (`server.Selectors.getIsConnected`) to render the protected screen instead
// of redirecting to /login.
export function simulateLoggedIn() {
  store.dispatch(server.Actions.updateStatus({
    status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null },
  }));
}

export { store };
