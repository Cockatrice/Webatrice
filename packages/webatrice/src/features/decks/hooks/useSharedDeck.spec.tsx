import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import {
  Response_DeckListSchema,
  Response_DeckShareListSchema,
  ServerInfo_DeckShareItemSchema,
  ServerInfo_DeckStorage_FolderSchema,
} from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { usePublicDecks, useSharedDeck } from './useSharedDeck';

const COD = '<cockatrice_deck version="1"><deckname>Burn</deckname><zone name="main">'
  + '<card number="4" name="Lightning Bolt"/></zone></cockatrice_deck>';

let shared: ReturnType<typeof useSharedDeck>;
function SharedProbe({ token }: { token: string | null }) {
  shared = useSharedDeck(token);
  return null;
}

let publicDecks: ReturnType<typeof usePublicDecks>;
function PublicProbe({ userName }: { userName: string }) {
  publicDecks = usePublicDecks(userName);
  return null;
}

function setupShared(token: string | null = 'tok') {
  const webClient = createMockWebClient();
  const { store } = renderWithProviders(<SharedProbe token={token} />, { preloadedState: connectedState, webClient });
  return { webClient, store };
}

function setupPublic(userName = 'bob') {
  const webClient = createMockWebClient();
  const { store } = renderWithProviders(<PublicProbe userName={userName} />, { preloadedState: connectedState, webClient });
  return { webClient, store };
}

const listing = (items: number[]) => create(Response_DeckShareListSchema, {
  name: 'Cube',
  expiresAt: 100n,
  items: items.map((id) => create(ServerInfo_DeckShareItemSchema, { id, name: `Deck ${id}` })),
});

describe('useSharedDeck', () => {
  it('lists the share\'s decks', () => {
    const { webClient, store } = setupShared();
    expect(webClient.request.session.deckShareList).toHaveBeenCalledWith('tok');
    expect(shared.listing).toEqual({ status: 'loading' });
    act(() => {
      store.dispatch(server.Actions.deckShareListed({ token: 'tok', share: listing([1, 2]) }));
    });
    expect(shared.listing).toMatchObject({ status: 'loaded', name: 'Cube', expiresAt: 100n });
  });

  it('asks nothing without a usable token', () => {
    const { webClient } = setupShared(null);
    expect(webClient.request.session.deckShareList).not.toHaveBeenCalled();
  });

  it('ignores another share\'s answers', () => {
    const { store } = setupShared();
    act(() => {
      store.dispatch(server.Actions.deckShareListed({ token: 'other', share: listing([1]) }));
    });
    expect(shared.listing).toEqual({ status: 'loading' });
  });

  it('says so when the share is empty, missing or expired', () => {
    const { store } = setupShared();
    act(() => {
      store.dispatch(server.Actions.deckShareListed({ token: 'tok', share: listing([]) }));
    });
    expect(shared.listing).toEqual({ status: 'failed', message: 'SharedDeck.empty' });
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckShareList', target: 'tok', responseCode: 15 }));
    });
    expect(shared.listing).toEqual({ status: 'failed', message: 'SharedDeck.notFound' });
  });

  it('opens one deck read-only', () => {
    const { webClient, store } = setupShared();
    act(() => shared.openItem(2));
    expect(webClient.request.session.deckShareDownload).toHaveBeenCalledWith('tok', 2);
    expect(shared.open).toEqual({ status: 'loading', id: 2 });
    act(() => {
      store.dispatch(server.Actions.deckShareDownloaded({ token: 'tok', itemId: 2, deck: COD }));
    });
    expect(shared.open).toMatchObject({ status: 'open', opened: { id: 2, xml: COD, deck: { name: 'Burn' } } });
    act(() => shared.close());
    expect(shared.open).toEqual({ status: 'idle' });
  });

  it.each([
    ['', 'SharedDeck.empty'],
    ['<not a deck/>', 'SharedDeck.unreadable'],
  ])('reports a download of %j as %s', (deck, message) => {
    const { store } = setupShared();
    act(() => shared.openItem(2));
    act(() => {
      store.dispatch(server.Actions.deckShareDownloaded({ token: 'tok', itemId: 2, deck }));
    });
    expect(shared.open).toEqual({ status: 'failed', id: 2, message });
  });

  it('serializes downloads so a failure belongs to the first requested item', () => {
    const { webClient, store } = setupShared();
    act(() => {
      shared.openItem(1);
      shared.openItem(2);
    });
    expect(webClient.request.session.deckShareDownload).toHaveBeenCalledTimes(1);
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckShareDownload', target: 'tok', responseCode: 7 }));
    });
    expect(shared.open).toMatchObject({ status: 'failed', id: 1 });
    act(() => shared.openItem(2));
    expect(webClient.request.session.deckShareDownload).toHaveBeenLastCalledWith('tok', 2);
  });

  it.each(['success', 'failure'] as const)('ignores a late %s after closing a download', (outcome) => {
    const { store } = setupShared();
    act(() => shared.openItem(1));
    act(() => shared.close());
    act(() => {
      store.dispatch(outcome === 'success'
        ? server.Actions.deckShareDownloaded({ token: 'tok', itemId: 1, deck: COD })
        : server.Actions.sessionCommandFailed({ command: 'deckShareDownload', target: 'tok', responseCode: 7 }));
    });
    expect(shared.open).toEqual({ status: 'idle' });
  });

  it('reports a failed download for the item it asked for', () => {
    const { store } = setupShared();
    act(() => shared.openItem(3));
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckShareDownload', target: 'tok', responseCode: 15 }));
    });
    expect(shared.open).toEqual({ status: 'failed', id: 3, message: 'SharedDeck.downloadFailed' });
  });
});

describe('usePublicDecks', () => {
  const tree = create(Response_DeckListSchema, { root: create(ServerInfo_DeckStorage_FolderSchema, { items: [] }) });

  it('lists the user\'s public decks from the store', () => {
    const { webClient, store } = setupPublic();
    expect(webClient.request.session.deckListOtherUser).toHaveBeenCalledWith('bob');
    expect(publicDecks.loading).toBe(true);
    act(() => {
      store.dispatch(server.Actions.publicDecks({ userName: 'bob', deckList: tree }));
    });
    expect(publicDecks.loading).toBe(false);
    expect(publicDecks.root).toBe(tree.root);
  });

  it('reports a failed listing with the response code', () => {
    const { store } = setupPublic();
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckListOtherUser', target: 'bob', responseCode: 15 }));
    });
    expect(publicDecks.listError).toBe('PublicDecks.listFailed');
    expect(publicDecks.loading).toBe(false);
  });

  it('opens the requested public deck only', () => {
    const { webClient, store } = setupPublic();
    act(() => publicDecks.openDeck(7));
    expect(webClient.request.session.deckDownloadPublic).toHaveBeenCalledWith(7);
    act(() => {
      store.dispatch(server.Actions.publicDeckDownloaded({ deckId: 8, deck: COD }));
    });
    expect(publicDecks.open).toEqual({ status: 'loading', id: 7 });
    act(() => {
      store.dispatch(server.Actions.publicDeckDownloaded({ deckId: 7, deck: COD }));
    });
    expect(publicDecks.open).toMatchObject({ status: 'open', opened: { id: 7 } });
  });

  it('reports an unreadable or refused public deck', () => {
    const { store } = setupPublic();
    act(() => publicDecks.openDeck(7));
    act(() => {
      store.dispatch(server.Actions.publicDeckDownloaded({ deckId: 7, deck: 'nope' }));
    });
    expect(publicDecks.open).toEqual({ status: 'failed', id: 7, message: 'PublicDecks.unreadable' });
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckDownloadPublic', target: '7', responseCode: 15 }));
    });
    expect(publicDecks.open).toEqual({ status: 'failed', id: 7, message: 'PublicDecks.openFailed' });
  });
});
