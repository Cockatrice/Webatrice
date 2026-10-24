import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { games, server } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';
import type { WebClient } from '@cockatrice/sockatrice';
import { Response_ResponseCode, Response_DeckListSchema, ServerInfo_PlayerPropertiesSchema } from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import {
  connectedWithRoomsState,
  createMockWebClient,
  makeStoreState,
  renderWithProviders,
} from '../../__test-utils__';
import { endSession } from '@app/services/session';
import GameLobby from './GameLobby';

const DECK = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_deck version="1">
  <deckname>Burn</deckname>
  <zone name="main"><card number="2" name="Lightning Bolt"/><card number="1" name="Mountain"/></zone>
  <zone name="side"><card number="1" name="Smash to Smithereens"/></zone>
</cockatrice_deck>`;

const WITH_PLAN = DECK.replace(
  '</cockatrice_deck>',
  '<sideboard_plan><name></name><move_card_to_zone><card_name>Mountain</card_name>'
    + '<start_zone>main</start_zone><target_zone>side</target_zone></move_card_to_zone></sideboard_plan></cockatrice_deck>',
);

interface LobbySpec {
  hostId?: number;
  deckList?: string;
  ready?: boolean;
  sideboardLocked?: boolean;
  opponentReady?: boolean;
}

function lobbyState({
  hostId = 1,
  deckList = DECK,
  ready = false,
  sideboardLocked = true,
  opponentReady = false,
}: LobbySpec = {}) {
  return makeStoreState({
    ...connectedWithRoomsState,
    server: { ...connectedWithRoomsState.server, backendDecks: { root: { items: [] } } },
    games: {
      games: {
        1: makeGameEntry({
          hostId,
          localPlayerId: 1,
          started: false,
          players: {
            1: makePlayerEntry({
              deckList,
              properties: makePlayerProperties({
                playerId: 1,
                deckHash: deckList ? 'abc' : '',
                readyStart: ready,
                sideboardLocked,
                userInfo: { name: 'Alice' },
              }),
            }),
            2: makePlayerEntry({
              properties: makePlayerProperties({
                playerId: 2,
                readyStart: opponentReady,
                userInfo: { name: 'Bob' },
              }),
            }),
          },
          seatOrder: [1, 2],
        }),
      },
    },
  });
}

function renderLobby(spec?: LobbySpec) {
  const webClient = createMockWebClient() as unknown as WebClient;
  const utils = renderWithProviders(<GameLobby gameId={1} />, { preloadedState: lobbyState(spec), webClient });
  return { ...utils, webClient };
}

function renderPicker() {
  const webClient = createMockWebClient() as unknown as WebClient;
  const state = lobbyState({ deckList: '' });
  state.server.backendDecks = create(Response_DeckListSchema, {
    root: { items: [{ id: 101, name: 'First deck', file: {} }, { id: 102, name: 'Second deck', file: {} }] },
  });
  const utils = renderWithProviders(<GameLobby gameId={1} />, { preloadedState: state, webClient });
  const pick = (name: string) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
    return vi.mocked(webClient.request.game.deckSelect).mock.lastCall?.[2];
  };
  return { ...utils, webClient, pick };
}

const setLocalSideboardLock = (sideboardLocked: boolean) => games.Actions.playerPropertiesChanged({
  gameId: 1,
  playerId: 1,
  properties: create(ServerInfo_PlayerPropertiesSchema, { sideboardLocked }),
});

const button = (name: string) => screen.getByRole('button', { name });

describe('GameLobby — refactor characterization', () => {
  it('kicks the remote seat with only the game and player ids', () => {
    const { webClient } = renderLobby({ hostId: 1 });
    fireEvent.click(button('GameLobby.player.kick'));
    expect(webClient.request.game.kickFromGame).toHaveBeenCalledExactlyOnceWith(1, { playerId: 2 });
  });

  it('keeps empty seats distinct from the seated player rows', () => {
    const state = lobbyState();
    state.games.games[1].info.maxPlayers = 4;
    renderWithProviders(<GameLobby gameId={1} />, { preloadedState: state });
    expect(screen.getAllByText('GameLobby.player.waiting')).toHaveLength(2);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('flattens nested decks, downloads each summary once, and preserves selection payloads', () => {
    const state = lobbyState({ deckList: '' });
    state.server.backendDecks = create(Response_DeckListSchema, { root: { items: [
      { id: 8101, name: 'Zebra', file: {} },
      { name: 'Nested', folder: { items: [{ id: 8102, name: 'alpha', file: {} }] } },
    ] } });
    const webClient = createMockWebClient();
    const { store } = renderWithProviders(<GameLobby gameId={1} />, { preloadedState: state, webClient });
    expect(webClient.request.session.deckDownload).toHaveBeenCalledWith(8101);
    expect(webClient.request.session.deckDownload).toHaveBeenCalledWith(8102);
    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 8101, deck: '<invalid/>' }));
      store.dispatch(server.Actions.deckDownloaded({ deckId: 8102, deck: DECK }));
    });
    expect(webClient.request.session.deckDownload).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('button').filter(b => ['alpha', 'Zebra'].includes(b.textContent ?? '')).map(b => b.textContent))
      .toEqual(['alpha', 'Zebra']);
    fireEvent.click(button('alpha'));
    expect(webClient.request.game.deckSelect).toHaveBeenCalledExactlyOnceWith(1, { deckId: 8102 }, expect.any(String));
    expect(webClient.request.game.gameSay).not.toHaveBeenCalled();
  });

  it('rejects an invalid upload and sends a valid file verbatim without a duplicate chat announcement', async () => {
    const { container, webClient } = renderLobby({ deckList: '' });
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['<other/>'], 'bad.cod')] } });
    await screen.findByText('Not a valid Cockatrice deck (.cod) file');
    expect(webClient.request.game.deckSelect).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [new File([DECK], 'deck.cod')] } });
    await waitFor(() => expect(webClient.request.game.deckSelect).toHaveBeenCalledWith(1, { deck: DECK }, expect.any(String)));
    expect(webClient.request.game.gameSay).not.toHaveBeenCalled();
  });
});

describe('GameLobby — game info (B6)', () => {
  it('opens the game settings from the lobby header', () => {
    const state = lobbyState();
    Object.assign(state.games.games[1].info, {
      maxPlayers: 4,
      withPassword: true,
      onlyRegistered: true,
      spectatorsAllowed: true,
      spectatorsCanChat: true,
    });
    renderWithProviders(<GameLobby gameId={1} />, { preloadedState: state });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(button('LobbyGameInfoDialog.open'));
    const dialog = screen.getByRole('dialog', { name: 'Test Game' });
    const fact = (label: string) => within(dialog).getByText(label).nextElementSibling;
    expect(fact('LobbyGameInfoDialog.row.host')).toHaveTextContent('Alice');
    expect(fact('LobbyGameInfoDialog.row.seats')).toHaveTextContent('LobbyGameInfoDialog.seats');
    expect(fact('LobbyGameInfoDialog.row.format')).toHaveTextContent('LobbyGameInfoDialog.format.any');
    fireEvent.click(within(dialog.querySelector('footer')!).getByRole('button', { name: 'Common.action.close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('GameLobby — force start (GAME-013)', () => {
  it('asks for confirmation, then sends ONE readyStart{ready, forceStart} and no kicks', () => {
    const { webClient } = renderLobby({ hostId: 1 });

    fireEvent.click(button('GameLobby.action.forceStart'));
    expect(webClient.request.game.readyStart).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('GameLobby.forceStart.title')).toBeInTheDocument();
    expect(within(dialog).getByText('GameLobby.forceStart.message')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'GameLink.yes' }));
    expect(webClient.request.game.readyStart).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.readyStart).toHaveBeenCalledWith(1, { ready: true, forceStart: true });
    expect(webClient.request.game.kickFromGame).not.toHaveBeenCalled();
  });

  it('sends nothing when the confirmation is declined', () => {
    const { webClient } = renderLobby({ hostId: 1 });
    fireEvent.click(button('GameLobby.action.forceStart'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'GameLink.no' }));
    expect(webClient.request.game.readyStart).not.toHaveBeenCalled();
  });

  it('is offered to an unready host (the server readies the host as part of the force start)', () => {
    renderLobby({ hostId: 1, ready: false, opponentReady: false });
    expect(button('GameLobby.action.forceStart')).toBeEnabled();
  });

  it('is hidden from non-hosts and before a deck is loaded (desktop deck-select state)', () => {
    renderLobby({ hostId: 2 });
    expect(screen.queryByRole('button', { name: 'GameLobby.action.forceStart' })).not.toBeInTheDocument();
  });
});

describe('GameLobby — deck states (GAME-014)', () => {
  it('unload cancels a ready command even before its echo arrives', () => {
    const { webClient } = renderLobby({ ready: false });
    fireEvent.click(button('GameLobby.action.readyStart'));
    fireEvent.click(button('GameLobby.action.unloadDeck'));
    expect(webClient.request.game.readyStart).toHaveBeenNthCalledWith(1, 1, { ready: true });
    expect(webClient.request.game.readyStart).toHaveBeenNthCalledWith(2, 1, { ready: false });
  });

  it('keeps the unloaded view across route navigation and observes deck selection while away', () => {
    const { rerender, store } = renderLobby();
    fireEvent.click(button('GameLobby.action.unloadDeck'));
    rerender(<div>Another route</div>);
    rerender(<GameLobby gameId={1} />);
    expect(screen.queryByTestId('lobby-deck-view')).not.toBeInTheDocument();
    rerender(<div>Another route</div>);
    act(() => {
      store.dispatch(games.Actions.deckSelected({ gameId: 1, deckList: DECK }));
    });
    rerender(<GameLobby gameId={1} />);
    expect(screen.getByTestId('lobby-deck-view')).toBeInTheDocument();
  });

  it('without a deck shows the deck picker and none of the deck-loaded buttons', () => {
    renderLobby({ deckList: '' });
    expect(screen.getByText('GameLobby.upload.heading')).toBeInTheDocument();
    for (const name of [
      'GameLobby.action.readyStart',
      'GameLobby.action.sideboardLocked',
      'GameLobby.action.unloadDeck',
      'GameLobby.action.forceStart',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('titles the deck area with a translated heading in both states', () => {
    renderLobby();
    expect(screen.getByText('GameLobby.deck.heading')).toBeInTheDocument();
  });

  it('with a deck shows Maindeck / Sideboard and hides the picker', () => {
    renderLobby();
    expect(screen.getByRole('heading', { name: 'GameLobby.deck.maindeck' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'GameLobby.deck.sideboard' })).toBeInTheDocument();
    expect(within(screen.getByTestId('lobby-deck-main')).getByText('Lightning Bolt')).toBeInTheDocument();
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Smash to Smithereens')).toBeInTheDocument();
    expect(screen.queryByText('GameLobby.upload.heading')).not.toBeInTheDocument();
  });

  it('Ready to start toggles readyStart', () => {
    const { webClient } = renderLobby({ ready: true });
    const ready = button('GameLobby.action.readyStart');
    expect(ready).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(ready);
    expect(webClient.request.game.readyStart).toHaveBeenCalledWith(1, { ready: false });
  });

  it('Unload deck returns to the picker and un-readies a ready player', () => {
    const { webClient } = renderLobby({ ready: true });
    fireEvent.click(button('GameLobby.action.unloadDeck'));
    expect(webClient.request.game.readyStart).toHaveBeenCalledWith(1, { ready: false });
    expect(screen.getByText('GameLobby.upload.heading')).toBeInTheDocument();
    expect(screen.queryByTestId('lobby-deck-view')).not.toBeInTheDocument();
  });

  it('a deck-select response re-enters the deck-loaded state after an unload', () => {
    const { store } = renderLobby();
    fireEvent.click(button('GameLobby.action.unloadDeck'));
    expect(screen.queryByTestId('lobby-deck-view')).not.toBeInTheDocument();
    act(() => {
      store.dispatch(games.Actions.deckSelected({ gameId: 1, deckList: DECK }));
    });
    expect(screen.getByTestId('lobby-deck-view')).toBeInTheDocument();
  });

  it('a failed deck select keeps the picker and says why', () => {
    const { store, pick } = renderPicker();
    const requestId = pick('First deck');
    act(() => {
      store.dispatch(games.Actions.deckSelectFailed({ gameId: 1, responseCode: Response_ResponseCode.RespContextError, requestId }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('GameLobby.deckSelectFailed');
    expect(screen.queryByTestId('lobby-deck-view')).not.toBeInTheDocument();
  });

  it('reports a deck select the server never answered with the transport reason', () => {
    const { store, pick } = renderPicker();
    const requestId = pick('First deck');
    act(() => {
      store.dispatch(games.Actions.deckSelectFailed({
        requestId,
        gameId: 1,
        responseCode: Response_ResponseCode.RespNotConnected,
        failure: WebsocketTypes.CommandFailure.Timeout,
      }));
    });
    expect(screen.queryByText('GameLobby.deckSelectFailed')).not.toBeInTheDocument();
    expect(screen.getByText('CommandFailure.timeout')).toBeInTheDocument();
  });

  it('ignores a failed deck select for another game', () => {
    const { store, pick } = renderPicker();
    const requestId = pick('First deck');
    act(() => {
      store.dispatch(games.Actions.deckSelectFailed({ gameId: 2, responseCode: Response_ResponseCode.RespContextError, requestId }));
    });
    expect(screen.queryByText('GameLobby.deckSelectFailed')).not.toBeInTheDocument();
  });
});

describe('GameLobby — sideboarding before ready (GAME-014)', () => {
  it('preserves the complete plan when returning to a route and moving another card', () => {
    const { webClient, rerender } = renderLobby({ sideboardLocked: false });
    fireEvent.click(screen.getByRole('button', { name: '2 Lightning Bolt' }));
    rerender(<div>Another route</div>);
    rerender(<GameLobby gameId={1} />);
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Lightning Bolt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 Smash to Smithereens' }));
    expect(webClient.request.game.setSideboardPlan).toHaveBeenLastCalledWith(1, {
      moveList: [
        { cardName: 'Smash to Smithereens', startZone: 'side', targetZone: 'main' },
        { cardName: 'Lightning Bolt', startZone: 'main', targetZone: 'side' },
      ],
    });
  });

  it('keeps lock resets received while away, including a same-deck reselection', () => {
    const { store, rerender } = renderLobby({ deckList: WITH_PLAN, sideboardLocked: false });
    rerender(<div>Another route</div>);
    act(() => {
      store.dispatch(setLocalSideboardLock(true));
    });
    rerender(<GameLobby gameId={1} />);
    expect(within(screen.getByTestId('lobby-deck-side')).queryByText('Mountain')).not.toBeInTheDocument();
    rerender(<div>Another route</div>);
    act(() => {
      store.dispatch(games.Actions.deckSelected({ gameId: 1, deckList: WITH_PLAN }));
    });
    rerender(<GameLobby gameId={1} />);
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Mountain')).toBeInTheDocument();
  });

  it('isolates plans and unloaded state between games with identical decks', () => {
    const state = lobbyState({ sideboardLocked: false });
    state.games.games[2] = { ...state.games.games[1] };
    const { rerender } = renderWithProviders(<GameLobby gameId={1} />, { preloadedState: state });
    fireEvent.click(screen.getByRole('button', { name: '2 Lightning Bolt' }));
    rerender(<GameLobby gameId={2} />);
    expect(within(screen.getByTestId('lobby-deck-side')).queryByText('Lightning Bolt')).not.toBeInTheDocument();
    fireEvent.click(button('GameLobby.action.unloadDeck'));
    rerender(<GameLobby gameId={1} />);
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Lightning Bolt')).toBeInTheDocument();
  });

  it('while locked, cards cannot move and the lock button unlocks', () => {
    const { webClient } = renderLobby({ sideboardLocked: true });
    const main = screen.getByTestId('lobby-deck-main');
    for (const row of within(main).getAllByRole('button')) {
      expect(row).toBeDisabled();
    }
    const lock = button('GameLobby.action.sideboardLocked');
    expect(lock).not.toHaveAttribute('aria-pressed');
    fireEvent.click(lock);
    expect(webClient.request.game.setSideboardLock).toHaveBeenCalledWith(1, { locked: false });
  });

  it('names each row by its count and card, describing the move only while it is possible', () => {
    renderLobby({ sideboardLocked: false });
    const bolt = screen.getByRole('button', { name: '2 Lightning Bolt' });
    expect(bolt).toHaveAccessibleDescription('GameLobby.deck.moveToSideboard');
  });

  it('a locked row keeps its count and card name and offers no move', () => {
    renderLobby({ sideboardLocked: true });
    const bolt = screen.getByRole('button', { name: '2 Lightning Bolt' });
    expect(bolt).toHaveAccessibleDescription('');
  });

  it('while unlocked, moving a card sends the whole plan in deck zones (main/side)', () => {
    const { webClient } = renderLobby({ sideboardLocked: false });
    const boltRow = within(screen.getByTestId('lobby-deck-main')).getByText('Lightning Bolt').closest('button')!;
    fireEvent.click(boltRow);
    expect(webClient.request.game.setSideboardPlan).toHaveBeenLastCalledWith(1, {
      moveList: [{ cardName: 'Lightning Bolt', startZone: 'main', targetZone: 'side' }],
    });
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Lightning Bolt')).toBeInTheDocument();

    const smashRow = within(screen.getByTestId('lobby-deck-side')).getByText('Smash to Smithereens').closest('button')!;
    fireEvent.click(smashRow);
    expect(webClient.request.game.setSideboardPlan).toHaveBeenLastCalledWith(1, {
      moveList: [
        { cardName: 'Smash to Smithereens', startZone: 'side', targetZone: 'main' },
        { cardName: 'Lightning Bolt', startZone: 'main', targetZone: 'side' },
      ],
    });
  });

  it('readying locks editing and disables the sideboard lock button', () => {
    const { webClient } = renderLobby({ sideboardLocked: false, ready: true });
    expect(button('GameLobby.action.sideboardUnlocked')).toBeDisabled();
    const boltRow = within(screen.getByTestId('lobby-deck-main')).getByText('Lightning Bolt').closest('button')!;
    expect(boltRow).toBeDisabled();
    fireEvent.click(boltRow);
    expect(webClient.request.game.setSideboardPlan).not.toHaveBeenCalled();
  });

  it('shows the plan stored in the deck while unlocked', () => {
    renderLobby({ deckList: WITH_PLAN, sideboardLocked: false });
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Mountain')).toBeInTheDocument();
  });

  it('shows the stored plan while locked: Command_DeckSelect locks without clearing it', () => {
    renderLobby({ deckList: WITH_PLAN, sideboardLocked: true });
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Mountain')).toBeInTheDocument();
    expect(within(screen.getByTestId('lobby-deck-main')).queryByText('Mountain')).not.toBeInTheDocument();
  });

  it('an explicit lock on the same deck resets the view to the bare deck, as the server clears the plan', () => {
    const { store } = renderLobby({ deckList: WITH_PLAN, sideboardLocked: false });
    act(() => {
      store.dispatch(setLocalSideboardLock(true));
    });
    expect(within(screen.getByTestId('lobby-deck-main')).getByText('Mountain')).toBeInTheDocument();
    expect(within(screen.getByTestId('lobby-deck-side')).queryByText('Mountain')).not.toBeInTheDocument();
  });

  it('re-selecting a deck after unlocking shows the stored plan again (the lock came from the deck select)', () => {
    const { store } = renderLobby({ deckList: WITH_PLAN, sideboardLocked: false });
    act(() => {
      store.dispatch(setLocalSideboardLock(true));
      store.dispatch(games.Actions.deckSelected({ gameId: 1, deckList: WITH_PLAN }));
    });
    expect(within(screen.getByTestId('lobby-deck-side')).getByText('Mountain')).toBeInTheDocument();
  });
});

describe('GameLobby deck-pick request ownership', () => {
  it('keeps the later pick when an earlier same-game pick fails', () => {
    const { store, pick } = renderPicker();
    const first = pick('First deck');
    const second = pick('Second deck');
    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 102, deck: DECK }));
      store.dispatch(games.Actions.playerPropertiesChanged({
        gameId: 1, playerId: 1, properties: create(ServerInfo_PlayerPropertiesSchema, { deckHash: 'abc' }),
      }));
    });
    act(() => store.dispatch(games.Actions.deckSelectFailed({ gameId: 1, responseCode: 3, requestId: first })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('GameLobby.player.waitingWithDeck')).toBeInTheDocument();
    expect(first).toEqual(expect.any(String));
    expect(second).not.toBe(first);
    act(() => store.dispatch(games.Actions.deckSelectFailed({ gameId: 1, responseCode: 3, requestId: second })));
    expect(screen.getByRole('alert')).toHaveTextContent('GameLobby.deckSelectFailed');
    act(() => store.dispatch(games.Actions.deckSelectFailed({
      gameId: 1, responseCode: 3, requestId: second, failure: WebsocketTypes.CommandFailure.Timeout,
    })));
    expect(screen.getByRole('alert')).toHaveTextContent('GameLobby.deckSelectFailed');
  });

  it('settles only its current success and ignores failures after settlement', () => {
    const { store, pick } = renderPicker();
    const first = pick('First deck');
    const second = pick('Second deck');
    act(() => store.dispatch(games.Actions.deckSelected({ gameId: 1, deckList: DECK, requestId: first })));
    fireEvent.click(button('GameLobby.action.unloadDeck'));
    act(() => store.dispatch(games.Actions.deckSelectFailed({ gameId: 1, responseCode: 3, requestId: second })));
    expect(screen.getByRole('alert')).toHaveTextContent('GameLobby.deckSelectFailed');
    const third = pick('Second deck');
    act(() => store.dispatch(games.Actions.deckSelected({ gameId: 1, deckList: DECK, requestId: third })));
    fireEvent.click(button('GameLobby.action.unloadDeck'));
    act(() => store.dispatch(games.Actions.deckSelectFailed({ gameId: 1, responseCode: 3, requestId: third })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('correlates uploaded decks as well as server picks', async () => {
    const { store, webClient, pick } = renderPicker();
    const first = pick('First deck');
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File([DECK], 'burn.cod', { type: 'text/xml' })] } });
    await waitFor(() => expect(webClient.request.game.deckSelect).toHaveBeenCalledTimes(2));
    const uploaded = vi.mocked(webClient.request.game.deckSelect).mock.lastCall?.[2];
    act(() => store.dispatch(games.Actions.deckSelectFailed({ gameId: 1, responseCode: 3, requestId: first })));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(uploaded).toEqual(expect.any(String));
    expect(uploaded).not.toBe(first);
    act(() => store.dispatch(games.Actions.deckSelectFailed({ gameId: 1, responseCode: 3, requestId: uploaded })));
    expect(screen.getByRole('alert')).toHaveTextContent('GameLobby.deckSelectFailed');
  });
});

describe('GameLobby deck summaries', () => {
  it('reuses summaries across lobby visits but not across sessions', () => {
    endSession();
    const downloadsOf = (webClient: WebClient, deckId: number) =>
      vi.mocked(webClient.request.session.deckDownload).mock.calls.filter(([id]) => id === deckId).length;

    const first = renderPicker();
    expect(downloadsOf(first.webClient, 101)).toBe(1);
    act(() => first.store.dispatch(server.Actions.deckDownloaded({ deckId: 101, deck: DECK })));
    first.unmount();

    const again = renderPicker();
    expect(downloadsOf(again.webClient, 101)).toBe(0);
    again.unmount();

    endSession();
    const nextSession = renderPicker();
    expect(downloadsOf(nextSession.webClient, 101)).toBe(1);
  });
});
