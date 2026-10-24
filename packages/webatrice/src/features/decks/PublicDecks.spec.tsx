import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import {
  Response_DeckListSchema,
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';

import { connected31State, connectedState, renderWithProviders } from '../../__test-utils__';
import PublicDecks from './PublicDecks';

const COD = '<cockatrice_deck version="1"><deckname>Elves</deckname><zone name="main">'
  + '<card number="4" name="Llanowar Elves"/></zone></cockatrice_deck>';

function renderPage(preloadedState = connected31State) {
  return renderWithProviders(
    <Routes><Route path={RouteEnum.PUBLIC_DECKS} element={<PublicDecks />} /></Routes>,
    { preloadedState, route: '/decks/public/bob' },
  );
}

const tree = (items: ReturnType<typeof create<typeof ServerInfo_DeckStorage_TreeItemSchema>>[]) =>
  create(Response_DeckListSchema, { root: create(ServerInfo_DeckStorage_FolderSchema, { items }) });

describe('PublicDecks', () => {
  it('lists the user\'s public decks and opens one read-only', () => {
    const { store, webClient } = renderPage();
    expect(screen.getByRole('heading', { name: 'PublicDecks.title' })).toBeInTheDocument();
    expect(webClient.request.session.deckListOtherUser).toHaveBeenCalledWith('bob');
    expect(screen.getByText('PublicDecks.loading')).toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.publicDecks({
        userName: 'bob',
        deckList: tree([create(ServerInfo_DeckStorage_TreeItemSchema, {
          id: 7, name: 'Elves', file: create(ServerInfo_DeckStorage_FileSchema, { isPublic: true, colorIdentity: 'G', tags: ['Tribal'] }),
        })]),
      }));
    });
    expect(screen.getByText('Elves')).toBeInTheDocument();
    expect(screen.getByText('Tribal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'PublicDecks.openDeckNamed' }));
    expect(webClient.request.session.deckDownloadPublic).toHaveBeenCalledWith(7);
    act(() => {
      store.dispatch(server.Actions.publicDeckDownloaded({ deckId: 7, deck: COD }));
    });
    expect(screen.getByText('Llanowar Elves')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ReadOnlyDeck.import/ }));
    expect(webClient.request.session.deckUpload).toHaveBeenCalledWith('', 0, COD, undefined, 'G', expect.any(String));
  });

  it('says when the user has published nothing', () => {
    const { store } = renderPage();
    act(() => {
      store.dispatch(server.Actions.publicDecks({ userName: 'bob', deckList: tree([]) }));
    });
    expect(screen.getByText('PublicDecks.empty')).toBeInTheDocument();
  });

  it('asks nothing of a server without public decks', () => {
    const { webClient } = renderPage(connectedState);
    expect(webClient.request.session.deckListOtherUser).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('DeckSharing.notSupported');
    expect(screen.queryByText('PublicDecks.empty')).toBeNull();
  });
});
