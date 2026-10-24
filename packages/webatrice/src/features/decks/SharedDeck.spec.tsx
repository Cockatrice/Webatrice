import { act, fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { Response_DeckShareListSchema, ServerInfo_DeckShareItemSchema } from '@cockatrice/sockatrice/generated';

import { connected31State, connectedState, createMockWebClient, renderWithProviders } from '../../__test-utils__';
import SharedDeck from './SharedDeck';

const knownHosts = vi.hoisted(() => {
  const loaded = {
    hosts: [] as { host: string; port: string; desktopPort?: string }[],
    selectedHost: { host: 'server.example', port: '4748' } as { host: string; port: string } | undefined,
  };
  return { loaded, value: loaded as typeof loaded | undefined };
});
vi.mock('@app/feature-widgets/known-hosts', () => ({
  useKnownHosts: () => ({ status: 'loaded', value: knownHosts.value }),
}));

afterEach(() => {
  knownHosts.loaded.hosts = [];
  knownHosts.value = knownHosts.loaded;
  knownHosts.loaded.selectedHost = { host: 'server.example', port: '4748' };
});

const COD = '<cockatrice_deck version="1"><deckname>Burn</deckname><zone name="main">'
  + '<card number="4" name="Lightning Bolt"/></zone></cockatrice_deck>';

function renderPage(
  query = 'share=tok&hostname=wss%3A%2F%2Fserver.example%3A4748%2F&port=4748',
  preloadedState = connected31State,
  endpoint: string | null = 'wss://server.example:4748/',
) {
  const webClient = createMockWebClient();
  Object.assign(webClient, { socket: { connectedEndpoint: endpoint } });
  return renderWithProviders(<SharedDeck />, { preloadedState, webClient, route: `/decks/shared?${query}` });
}

describe('SharedDeck', () => {
  it.each([
    ['server.example', '4747', '4747', null],
    ['server.example', '4747', undefined, 'SharedDeck.desktopPortRequired'],
    ['server.example', '5747', '4747', 'SharedDeck.otherServer'],
    ['other.example', '4747', '4747', 'SharedDeck.otherServer'],
  ])('checks saved desktop port before sending a token to %s:%s (%s)', (hostname, port, desktopPort, problem) => {
    knownHosts.loaded.hosts = [{ host: 'server.example', port: '4748', desktopPort }];
    const { webClient } = renderPage(`share=tok&hostname=${hostname}&port=${port}`);
    if (problem) {
      expect(webClient.request.session.deckShareList).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(problem);
    } else {
      expect(webClient.request.session.deckShareList).toHaveBeenCalledWith('tok');
    }
  });

  it('lists the share, opens a deck read-only and imports a copy', () => {
    const { store, webClient } = renderPage();
    expect(webClient.request.session.deckShareList).toHaveBeenCalledWith('tok');
    expect(screen.getByText('SharedDeck.loading')).toBeInTheDocument();

    act(() => {
      store.dispatch(server.Actions.deckShareListed({
        token: 'tok',
        share: create(Response_DeckShareListSchema, {
          name: 'Cube',
          expiresAt: 1800000000n,
          items: [create(ServerInfo_DeckShareItemSchema, { id: 2, name: 'Burn', gameFormat: 'modern', colorIdentity: 'R' })],
        }),
      }));
    });
    expect(screen.getByText('SharedDeck.share')).toBeInTheDocument();
    expect(screen.getByText('SharedDeck.from')).toBeInTheDocument();
    expect(screen.getByText('SharedDeck.expires')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'SharedDeck.openDeckNamed' }));
    expect(webClient.request.session.deckShareDownload).toHaveBeenCalledWith('tok', 2);
    act(() => {
      store.dispatch(server.Actions.deckShareDownloaded({ token: 'tok', itemId: 2, deck: COD }));
    });
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ReadOnlyDeck.import/ }));
    expect(webClient.request.session.deckUpload).toHaveBeenCalledWith('', 0, COD, undefined, 'R', expect.any(String));
  });

  it('disables every Open button while a download is pending', () => {
    const { store } = renderPage();
    act(() => {
      store.dispatch(server.Actions.deckShareListed({ token: 'tok', share: create(Response_DeckShareListSchema, {
        items: [1, 2].map(id => create(ServerInfo_DeckShareItemSchema, { id, name: `Deck ${id}` })),
      }) }));
    });
    const buttons = screen.getAllByRole('button', { name: 'SharedDeck.openDeckNamed' });
    fireEvent.click(buttons[0]);
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  it.each([
    'wss://server.example:5748/',
    'wss://server.example:4748/server-b',
  ])('sends no token to a different live endpoint: %s', (endpoint) => {
    const { webClient } = renderPage(undefined, connected31State, endpoint);
    expect(webClient.request.session.deckShareList).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('SharedDeck.otherServer');
  });

  it('names what is missing from an incomplete link, like desktop', () => {
    const { webClient } = renderPage('share=tok&port=4747');
    expect(screen.getByRole('alert')).toHaveTextContent('OpenShareLink.problem.hostname');
    expect(webClient.request.session.deckShareList).not.toHaveBeenCalled();
  });

  it('says which server a link for another server needs', () => {
    const { webClient } = renderPage('share=tok&hostname=elsewhere.example&port=4747');
    expect(screen.getByRole('alert')).toHaveTextContent('SharedDeck.otherServer');
    expect(webClient.request.session.deckShareList).not.toHaveBeenCalled();
  });

  it('uses the live endpoint while the known hosts are not loaded', () => {
    knownHosts.value = undefined;
    const { webClient } = renderPage();
    expect(webClient.request.session.deckShareList).toHaveBeenCalledWith('tok');
  });

  it('sends the token nowhere without a live connection endpoint', () => {
    knownHosts.loaded.selectedHost = undefined;
    const { webClient } = renderPage(undefined, connected31State, null);
    expect(screen.getByRole('alert')).toHaveTextContent('SharedDeck.otherServer');
    expect(webClient.request.session.deckShareList).not.toHaveBeenCalled();
  });

  it('asks nothing of a server without share links', () => {
    const { webClient } = renderPage(undefined, connectedState);
    expect(screen.getByRole('alert')).toHaveTextContent('DeckSharing.notSupported');
    expect(webClient.request.session.deckShareList).not.toHaveBeenCalled();
  });

  it('shows desktop\'s message for a missing or expired share', () => {
    const { store } = renderPage();
    act(() => {
      store.dispatch(server.Actions.sessionCommandFailed({ command: 'deckShareList', target: 'tok', responseCode: 15 }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('SharedDeck.notFound');
  });
});
