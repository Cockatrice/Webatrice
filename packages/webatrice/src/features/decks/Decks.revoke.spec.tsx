import { act, fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_DeckShareSummarySchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { connected31State, createMockWebClient, renderWithProviders } from '../../__test-utils__';
import Decks from './Decks';

describe('pending share revocation', () => {
  it.each([
    [undefined, 'DeckShareLinks.revokeFailed'],
    [WebsocketTypes.CommandFailure.Timeout, 'CommandFailure.timeout'],
  ] as const)('keeps the dialog open until a failure can be seen (%s)', (failure, message) => {
    const { store, webClient } = renderWithProviders(<Decks />, {
      preloadedState: connected31State, webClient: createMockWebClient(),
    });
    fireEvent.click(screen.getByRole('button', { name: /DeckShareLinks.open/ }));
    act(() => {
      store.dispatch(server.Actions.deckSharesMine({ shares: [create(ServerInfo_DeckShareSummarySchema, { id: 4, name: 'Cube' })] }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.revokeNamed' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.revoke' }));
    expect(webClient.request.session.deckShareRemove).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'DeckShareLinks.title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DeckShareLinks.close' })).toBeDisabled();
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckShareRemove', target: '4', responseCode: 7, failure }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'DeckShareLinks.close' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.close' }));
    expect(screen.queryByRole('dialog', { name: 'DeckShareLinks.title' })).toBeNull();
  });
});
