import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { combineReducers } from '@reduxjs/toolkit';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { Event_GameStateChangedSchema, ServerInfo_Zone_ZoneType } from '@cockatrice/sockatrice/generated';
import { Route, Routes } from 'react-router-dom';

import { attachResponseHandlers, createStore } from '@cockatrice/datatrice';
import { ZoneName } from '@cockatrice/sockatrice';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- the test drives a real client through the replay sink
import { WebClient } from '@cockatrice/sockatrice';
import {
  makeCard,
  makeGameEntry,
  makeGameInfo,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import { closeReplay, getOpenedReplay, getOpenedReplays, openReplay, parseReplay } from '@app/services';
import { rootReducerMap, type RootState } from '@app/store';
import { ShortcutProvider } from '@app/feature-widgets/shortcuts';
import { RouteEnum } from '@app/types';

import { createMockWebClient, connectedState, makeStoreState, makeUser, renderWithProviders } from '../../../__test-utils__';
import { buildReplay, sayContainer } from '../../../services/replay/__mocks__/fixtures';
import { ReplayEngine } from '../../../services/replay/ReplayEngine';
import { GameBoard } from '../Game';
import { GameReadOnlyProvider } from '../components/ui/GameReadOnlyContext';
import GameReplay from './GameReplay';

vi.mock('../../../hooks/useSettings');
vi.mock('../../../services/cards/cardCatalog', async () =>
  (await import('../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

function renderReplayRoute(replayKey: string, webClient: WebClient = createMockWebClient(), store = makeStore()) {
  return renderWithProviders(
    <ShortcutProvider><Routes>
      <Route path={RouteEnum.REPLAY} element={<GameReplay />} />
      <Route path={RouteEnum.REPLAYS} element={<div data-testid="replays-page" />} />
      <Route path={RouteEnum.SERVER} element={<div data-testid="server-page" />} />
    </Routes></ShortcutProvider>,
    {
      route: `/replay/${replayKey}`,
      store,
      webClient,
      gameId: undefined,
    },
  );
}

function makeStore() {
  return createStore<RootState>({
    reducer: combineReducers(rootReducerMap),
    preloadedState: makeStoreState({ ...connectedState, games: { games: {}, pings: {} } }),
  });
}

function openTestReplay(replay = buildReplay([sayContainer(0)])) {
  const store = makeStore();
  const webClient = createMockWebClient();
  const response = attachResponseHandlers(store);
  vi.mocked(webClient.loadReplayGame).mockImplementation((gameId, gameInfo) => response.game.replayGameLoaded?.(gameId, gameInfo));
  vi.mocked(webClient.unloadReplayGame).mockImplementation((gameId) => response.game.replayGameUnloaded?.(gameId));
  const key = openReplay(replay, 'fixture.cor', webClient);
  return { key, store, webClient, render: () => renderReplayRoute(key, webClient, store) };
}

afterEach(() => {
  getOpenedReplays().forEach(({ key }) => closeReplay(key));
});

function allRequestSpies(webClient: WebClient) {
  return Object.values(webClient.request).flatMap((scope) => Object.values(scope as unknown as Record<string, ReturnType<typeof vi.fn>>));
}

describe('GameReplay route', () => {
  it('explains that a replay is gone after a reload and links back to the replays tab', () => {
    renderReplayRoute('does-not-exist');

    expect(screen.getByTestId('replay-missing')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GameReplay.backToReplays' })).toHaveAttribute('href', RouteEnum.REPLAYS);
  });

  it('plays an opened replay on the read-only board with the replay dock', () => {
    const { render, store } = openTestReplay(buildReplay([sayContainer(0), sayContainer(2)]));
    render();

    expect(screen.getByTestId('replay-controls')).toBeInTheDocument();
    expect(screen.getByTestId('replay-time')).toHaveTextContent('0:00 / 0:02');
    expect(screen.getByTestId('game-container')).toHaveAttribute('data-readonly', 'true');
    expect(screen.getByTestId('spectating-tag')).toHaveTextContent('GameReplay.sidebar.tag');
    expect(screen.queryByTestId('game-log-timer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('ChatLog.inputLabel').closest('form')).not.toBeVisible();
    expect(screen.queryByRole('button', { name: 'GameInvite.copyLink' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'GameInvite.inviteToGame' })).not.toBeInTheDocument();

    const replayGames = Object.values(store.getState().games.games).filter((g) => g.replay);
    expect(replayGames).toHaveLength(1);
  });

  it('seats every player of a Servatrice recording on the read-only board', () => {
    const store = makeStore();
    WebClient.dispose();
    const client = new WebClient(
      attachResponseHandlers(store),
      { clientid: 'test', clientver: '0', clientfeatures: [] },
      { autojoinrooms: false, keepalive: 0 },
    );
    try {
      const bytes = new Uint8Array(readFileSync(resolve(__dirname, '../../../services/replay/__mocks__/two-player-game.cor')));
      const key = openReplay(parseReplay(bytes), 'two-player-game.cor', client);
      renderReplayRoute(key, client, store);

      expect(screen.queryAllByRole('region', { name: /'s seat$/ })).toHaveLength(0);

      act(() => getOpenedReplay(key)!.engine.seek(400));

      const seats = screen.getAllByRole('region', { name: /'s seat$/ });
      expect(seats.map((seat) => seat.getAttribute('aria-label'))).toEqual(['e2e_838e22f2\'s seat', 'e2e_32acb986\'s seat']);
      expect(screen.getByTestId('game-container')).toHaveAttribute('data-readonly', 'true');
    } finally {
      WebClient.dispose();
    }
  });

  it.each(['.game__board button', '[data-replay-zone-view="grave"]'])('toggles playback with Space while %s has focus', (selector) => {
    const { key, store, render } = openTestReplay(buildReplay([sayContainer(0), sayContainer(30)]));
    const opened = getOpenedReplay(key)!;
    attachResponseHandlers(store).game.gameStateChanged(opened.gameId, create(Event_GameStateChangedSchema, {
      gameStarted: true,
      playerList: [{
        properties: makePlayerProperties({ playerId: 0, userInfo: makeUser({ name: 'P0' }) }),
        zoneList: [
          {
            name: ZoneName.TABLE, type: ServerInfo_Zone_ZoneType.PublicZone,
            cardList: [makeCard({ id: 10, name: 'Island' })], cardCount: 1,
          },
          { name: ZoneName.GRAVE, type: ServerInfo_Zone_ZoneType.PublicZone, cardCount: 0 },
        ],
      }],
    }));
    const { container } = render();
    const target = container.querySelector<HTMLElement>(selector)!;
    expect(target).not.toBeNull();
    target.focus();
    expect(target).toHaveFocus();
    fireEvent.keyDown(target, { key: ' ', code: 'Space' });
    expect(opened.engine.getState().playing).toBe(true);
    fireEvent.keyDown(target, { key: ' ', code: 'Space' });
    expect(opened.engine.getState().playing).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the replay from the sidebar instead of leaving a game', () => {
    const { key, render, store, webClient } = openTestReplay();
    render();

    fireEvent.click(screen.getByRole('button', { name: /GameReplay\.sidebar\.close/ }));

    expect(screen.getByTestId('replays-page')).toBeInTheDocument();
    expect(webClient.request.game.leaveGame).not.toHaveBeenCalled();
    expect(getOpenedReplay(key)).toBeUndefined();
    expect(Object.values(store.getState().games.games).filter((g) => g.replay)).toHaveLength(0);
  });

  it('keeps the replay open and its game loaded when the view is left without closing it', () => {
    const { key, render, store } = openTestReplay(buildReplay([sayContainer(0), sayContainer(2)]));
    const { unmount } = render();
    act(() => getOpenedReplay(key)!.engine.seek(2000));
    unmount();

    expect(getOpenedReplay(key)).toBeDefined();
    expect(Object.values(store.getState().games.games).filter((g) => g.replay)).toHaveLength(1);

    render();
    expect(screen.getByTestId('replay-time')).toHaveTextContent('0:02 / 0:02');
  });
});

describe('GameBoard in read-only mode', () => {
  const REPLAY_GAME_ID = -1001;

  function boardState(withViews = false) {
    const players = Object.fromEntries([0, 1].map((pid) => [pid, makePlayerEntry({
      properties: makePlayerProperties({ playerId: pid, userInfo: makeUser({ name: `P${pid}` }) }),
      zones: {
        [ZoneName.TABLE]: makeZoneEntry({ name: ZoneName.TABLE, cards: [makeCard({ id: 10 + pid, name: 'Island' })], cardCount: 1 }),
        [ZoneName.HAND]: makeZoneEntry({ name: ZoneName.HAND, cards: [makeCard({ id: 20 + pid, name: 'Forest' })], cardCount: 1 }),
        [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK, cardCount: 30 }),
        [ZoneName.GRAVE]: makeZoneEntry({ name: ZoneName.GRAVE, cards: withViews ? [makeCard({ id: 30 + pid, name: 'Opt' })] : [] }),
        [ZoneName.EXILE]: makeZoneEntry({ name: ZoneName.EXILE, cards: withViews ? [makeCard({ id: 40 + pid, name: 'Duress' })] : [] }),
        [ZoneName.SIDEBOARD]: makeZoneEntry({
          name: ZoneName.SIDEBOARD, type: ServerInfo_Zone_ZoneType.HiddenZone, cardCount: 15,
        }),
      },
    })]));
    return makeStoreState({
      ...connectedState,
      games: {
        games: {
          [REPLAY_GAME_ID]: makeGameEntry({
            localPlayerId: 0,
            hostId: 0,
            started: true,
            activePlayerId: 0,
            activePhase: 3,
            players,
            info: makeGameInfo({ spectatorsOmniscient: true }),
          }),
        },
      },
    });
  }

  async function hammerBoard(readOnly: boolean) {
    const webClient = createMockWebClient();
    renderWithProviders(
      <GameReadOnlyProvider value={readOnly}>
        <GameBoard gameId={REPLAY_GAME_ID} />
      </GameReadOnlyProvider>,
      { preloadedState: boardState(), webClient, gameId: undefined },
    );
    vi.clearAllMocks();
    const board = screen.getByTestId('game-container').querySelector('.game__board')!;
    for (const element of [board, ...Array.from(board.querySelectorAll('*'))]) {
      fireEvent.pointerDown(element);
      fireEvent.mouseDown(element);
      fireEvent.click(element);
      fireEvent.doubleClick(element);
      fireEvent.contextMenu(element);
    }
    await act(async () => {});
    return allRequestSpies(webClient).filter((spy) => spy.mock.calls.length > 0);
  }

  it('lets no press, click or menu on the board reach a game command', async () => {
    expect(await hammerBoard(true)).toEqual([]);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it.each([
    [ZoneName.GRAVE, 'Graveyard', 'Opt'],
    [ZoneName.EXILE, 'Exile', 'Duress'],
  ])('opens the replay %s view without card menus, drags or commands', async (zone, title, name) => {
    const webClient = createMockWebClient();
    const { container } = renderWithProviders(
      <GameReadOnlyProvider value><GameBoard gameId={REPLAY_GAME_ID} /></GameReadOnlyProvider>,
      { preloadedState: boardState(true), webClient, gameId: undefined },
    );
    vi.clearAllMocks();
    const trigger = container.querySelector<HTMLElement>(`[data-replay-zone-view="${zone}"]`)!;
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger);
    const panel = screen.getByRole('heading', { name: new RegExp(`^${title}`) }).closest<HTMLElement>('[role="dialog"]')!;
    const card = within(panel).getByRole('option', { name });
    fireEvent.contextMenu(card);
    fireEvent.keyDown(card, { key: 'F10', shiftKey: true });
    fireEvent.keyDown(card, { key: 'm', code: 'KeyM' });
    fireEvent.doubleClick(card);
    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 100 });
    const boardCard = container.querySelector<HTMLElement>('[data-card-id="10"]')!;
    expect(fireEvent.contextMenu(boardCard)).toBe(false);
    expect(fireEvent.dragStart(boardCard)).toBe(false);
    expect(fireEvent.pointerDown(boardCard)).toBe(false);
    fireEvent.keyDown(boardCard, { key: 'F10', shiftKey: true });
    await act(async () => {});
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.querySelector('[data-drag-ghost]')).toBeNull();
    expect(screen.queryByRole('dialog', { name: /Move/ })).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByTitle('ZoneViewPanel.close'));
    expect(allRequestSpies(webClient).filter((spy) => spy.mock.calls.length > 0)).toEqual([]);
  });

  it('offers no sideboard view in replays', () => {
    const { container } = renderWithProviders(
      <GameReadOnlyProvider value><GameBoard gameId={REPLAY_GAME_ID} /></GameReadOnlyProvider>,
      { preloadedState: boardState(true), gameId: undefined },
    );
    expect(container.querySelector('[data-replay-zone-view="sb"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /sideboard/i })).not.toBeInTheDocument();
  });

  it('keeps an open replay graveyard view current across seek and rewind state replacements', () => {
    const webClient = createMockWebClient();
    const { container, store } = renderWithProviders(
      <GameReadOnlyProvider value><GameBoard gameId={REPLAY_GAME_ID} /></GameReadOnlyProvider>,
      { preloadedState: boardState(true), webClient, gameId: undefined },
    );
    vi.clearAllMocks();
    const trigger = container.querySelector<HTMLElement>(`[data-replay-zone-view="${ZoneName.GRAVE}"]`)!;
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger);
    const response = attachResponseHandlers(store);
    const engine = new ReplayEngine(buildReplay([sayContainer(0), sayContainer(1), sayContainer(3)]), {
      rewind: () => response.game.replayGameLoaded?.(REPLAY_GAME_ID, makeGameInfo()),
      apply: (event) => response.game.gameStateChanged(REPLAY_GAME_ID, create(Event_GameStateChangedSchema, {
        gameStarted: true,
        playerList: [{
          properties: makePlayerProperties({ playerId: 0, userInfo: makeUser({ name: 'P0' }) }),
          zoneList: [{
            name: ZoneName.GRAVE, type: ServerInfo_Zone_ZoneType.PublicZone,
            cardList: [makeCard({ id: 50, name: event.secondsElapsed === 0 ? 'Ponder' : 'Island' })], cardCount: 1,
          }],
        }],
      })),
    });
    try {
      for (const [time, name] of [[2000, 'Island'], [200, 'Ponder']] as const) {
        act(() => engine.seek(time));
        const panel = screen.getByRole('heading', { name: /^Graveyard/ }).closest<HTMLElement>('[role="dialog"]')!;
        expect(within(panel).getByRole('option', { name })).toBeInTheDocument();
      }
      expect(engine.getRewindCount()).toBe(1);
    } finally {
      engine.dispose();
    }
    expect(allRequestSpies(webClient).filter((spy) => spy.mock.calls.length > 0)).toEqual([]);
  });

  it('lets no click on the phase track reach a game command', () => {
    const webClient = createMockWebClient();
    renderWithProviders(
      <GameReadOnlyProvider value>
        <GameBoard gameId={REPLAY_GAME_ID} />
      </GameReadOnlyProvider>,
      { preloadedState: boardState(), webClient, gameId: undefined },
    );
    vi.clearAllMocks();
    const phaseBar = screen.getByTestId('phase-bar');
    for (const element of [phaseBar, ...Array.from(phaseBar.querySelectorAll('*'))]) {
      fireEvent.click(element);
      fireEvent.doubleClick(element);
    }
    expect(allRequestSpies(webClient).filter((spy) => spy.mock.calls.length > 0)).toEqual([]);
  });

  it('the same input on a live board does reach the server (control)', async () => {
    expect((await hammerBoard(false)).length).toBeGreaterThan(0);
  });

  it('marks the board read-only and drops the live-game confirmations', () => {
    renderWithProviders(
      <GameReadOnlyProvider value>
        <GameBoard gameId={REPLAY_GAME_ID} />
      </GameReadOnlyProvider>,
      { preloadedState: boardState(), gameId: undefined },
    );

    expect(screen.getByTestId('game-container')).toHaveAttribute('data-readonly', 'true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
