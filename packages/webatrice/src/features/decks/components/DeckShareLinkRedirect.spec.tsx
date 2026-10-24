import { act, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { disconnectedState, renderWithProviders } from '../../../__test-utils__';
import { DeckShareLinkRedirect } from './DeckShareLinkRedirect';

function Location() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe('DeckShareLinkRedirect', () => {
  const original = window.location.href;
  afterEach(() => {
    window.history.replaceState(null, '', original);
  });

  it('takes the link from the page fragment and opens it after login', () => {
    window.history.replaceState(null, '', '/#share=tok&hostname=server.example&port=4748');
    const { store } = renderWithProviders(<><DeckShareLinkRedirect /><Location /></>, { preloadedState: disconnectedState });
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain('tok');
    expect(window.sessionStorage.length).toBe(0);
    expect(screen.getByTestId('location').textContent).toBe('/');

    act(() => {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
    });
    expect(screen.getByTestId('location').textContent).toBe('/decks/shared?share=tok&hostname=server.example&port=4748');
  });

  it('keeps hostile values as data: the route is fixed and the values stay encoded', () => {
    window.history.replaceState(null, '', '/#share=a%26port%3D1&hostname=%2F%2Fevil.example&port=4748&next=%2F%2Fevil');
    const { store } = renderWithProviders(<><DeckShareLinkRedirect /><Location /></>, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
    });
    expect(screen.getByTestId('location').textContent)
      .toBe('/decks/shared?share=a%26port%3D1&hostname=%2F%2Fevil.example&port=4748');
  });

  it('does not open a link given in the query', () => {
    window.history.replaceState(null, '', '/?share=tok&hostname=server.example&port=4748');
    const { store } = renderWithProviders(<><DeckShareLinkRedirect /><Location /></>, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
    });
    expect(screen.getByTestId('location').textContent).toBe('/');
  });

  it('does nothing without a link', () => {
    window.history.replaceState(null, '', '/');
    const { store } = renderWithProviders(<><DeckShareLinkRedirect /><Location /></>, { preloadedState: disconnectedState });
    act(() => {
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
    });
    expect(screen.getByTestId('location').textContent).toBe('/');
  });
});
