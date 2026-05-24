// M4–M6 orchestration tests — extracted from Game.spec.tsx so they run in
// their own vitest worker slot (pool: 'threads'). Each of these goes through
// the Game.tsx state wiring between a trigger component and the dialog/menu
// it opens; individual handlers are tested in child specs. This suite pins
// the end-to-end dispatch so a regression that disconnects state from its
// consumers is caught even when both sides still pass in isolation.
import { screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { Enriched } from '@cockatrice/datatrice';
import { createMockWebClient, makeStoreState, renderWithProviders, connectedState, makeUser } from '../../__test-utils__';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import Game from './Game';

// Layout pulls in LeftNav which is not under test here; stub to a no-op.
vi.mock('../../components/Layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Block TurnControls' / Battlefield's Dexie-backed useSettings from firing
// an async settle after mount (would produce an unwrapped React state update).
vi.mock('../../hooks/useSettings');

// Right-panel + board chrome not exercised by this suite. Stub to no-ops so the
// orchestration tests render only the trigger → state → dialog path. Notably this
// drops GameLog's real-timer setInterval, the main source of cross-test variance.
vi.mock('./components/right-sidebar/GameLog/GameLog', () => ({ default: () => null }));
vi.mock('./components/right-sidebar/CardPreview/CardPreview', () => ({ default: () => null }));
vi.mock('./components/right-sidebar/PlayerList/PlayerList', () => ({ default: () => null }));
vi.mock('./components/right-sidebar/PhaseBar/PhaseBar', () => ({ default: () => null }));
vi.mock('./components/arrows/GameArrowOverlay/GameArrowOverlay', () => ({ default: () => null }));

// Every test here renders the full <Game /> tree and drives it through RTL
// queries — a genuinely heavy integration suite. The default 15s testTimeout
// left no headroom on a loaded dev machine; 30s reflects the real cost.
vi.setConfig({ testTimeout: 30000 });

interface BuildGameOpts {
  localId: number;
  opponentIds: number[];
  tableCards?: ReturnType<typeof makeCard>[];
  started?: boolean;
  spectator?: boolean;
  judge?: boolean;
  localReadyStart?: boolean;
  graveCards?: ReturnType<typeof makeCard>[];
}

function buildGame({
  localId,
  opponentIds,
  tableCards = [],
  started = true,
  spectator = false,
  judge = false,
  localReadyStart = false,
  graveCards = [],
}: BuildGameOpts) {
  const players: Record<number, ReturnType<typeof makePlayerEntry>> = {};
  const playerIds = [localId, ...opponentIds];
  for (const pid of playerIds) {
    players[pid] = makePlayerEntry({
      properties: makePlayerProperties({
        playerId: pid,
        userInfo: makeUser({ name: `P${pid}` }),
        readyStart: pid === localId ? localReadyStart : false,
      }),
      zones: {
        [Enriched.ZoneName.TABLE]: makeZoneEntry({
          name: Enriched.ZoneName.TABLE,
          cards: pid === localId ? tableCards : [],
          cardCount: pid === localId ? tableCards.length : 0,
        }),
        [Enriched.ZoneName.HAND]: makeZoneEntry({ name: Enriched.ZoneName.HAND }),
        [Enriched.ZoneName.DECK]: makeZoneEntry({ name: Enriched.ZoneName.DECK, cardCount: 40 }),
        [Enriched.ZoneName.GRAVE]: makeZoneEntry({
          name: Enriched.ZoneName.GRAVE,
          cards: pid === localId ? graveCards : [],
          cardCount: pid === localId ? graveCards.length : 0,
        }),
        [Enriched.ZoneName.EXILE]: makeZoneEntry({ name: Enriched.ZoneName.EXILE }),
      },
    });
  }
  return makeStoreState({
    ...connectedState,
    games: {
      games: {
        1: makeGameEntry({
          localPlayerId: localId,
          spectator,
          judge,
          started,
          players,
        }),
      },
    },
  });
}

describe('Game orchestration (M4–M6)', () => {
  // The first <Game /> render in a worker pays one-time cold costs (V8 JIT of the
  // render path, MUI/emotion cache warmup, initial jsdom layout). Absorb that here
  // so it isn't charged against the first it()'s timeout budget — without it the
  // leading test intermittently brushed the 15s testTimeout.
  beforeAll(() => {
    renderWithProviders(<Game />, {
      preloadedState: buildGame({ localId: 1, opponentIds: [2] }),
      webClient: createMockWebClient(),
    });
    cleanup();
  });

  it('Roll Die: TurnControls → RollDieDialog → rollDie dispatch', async () => {
    const webClient = createMockWebClient();
    renderWithProviders(<Game />, {
      preloadedState: buildGame({ localId: 1, opponentIds: [2] }),
      webClient,
    });

    // Scope role/name lookups to a small subtree. An unscoped
    // `screen.getByRole('button', { name })` recomputes accessible names across
    // the whole <Game /> document (~2s each here) — the dominant cost that made
    // this test brush the timeout under load.
    const rollDieBtn = within(screen.getByTestId('turn-controls')).getByRole('button', {
      name: /roll die/i,
    });
    fireEvent.click(rollDieBtn);
    const sides = await screen.findByLabelText('Sides') as HTMLInputElement;
    const count = screen.getByLabelText('Count') as HTMLInputElement;
    fireEvent.change(sides, { target: { value: '20' } });
    fireEvent.change(count, { target: { value: '2' } });
    const rollBtn = within(screen.getByRole('dialog')).getByRole('button', { name: /^roll$/i });
    fireEvent.click(rollBtn);

    expect(webClient.request.game.rollDie).toHaveBeenCalledWith(1, { sides: 20, count: 2 });
  });

  it('Kick: TurnControls host menu → kickFromGame with chosen opponent', async () => {
    const webClient = createMockWebClient();
    renderWithProviders(<Game />, {
      // localId 1 is the host by fixture default (hostId: 1).
      preloadedState: buildGame({ localId: 1, opponentIds: [2, 3] }),
      webClient,
    });

    fireEvent.click(screen.getByRole('button', { name: /kick/i }));
    // P3 also appears in the slot selectors; pick the one inside the
    // MUI Menu popup.
    const menuItem = (await screen.findAllByText('P3')).find((el) => el.closest('[role="menuitem"]'));
    fireEvent.click(menuItem!);

    expect(webClient.request.game.kickFromGame).toHaveBeenCalledWith(1, { playerId: 3 });
  });

  it('Create Token: PlayerContextMenu → CreateTokenDialog → createToken', async () => {
    const webClient = createMockWebClient();
    renderWithProviders(<Game />, {
      preloadedState: buildGame({ localId: 1, opponentIds: [2] }),
      webClient,
    });

    fireEvent.contextMenu(screen.getByTestId('player-info-1'));
    fireEvent.click(await screen.findByText('Create token…'));

    const nameInput = await screen.findByLabelText('Token name');
    fireEvent.change(nameInput, { target: { value: 'Goblin' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(webClient.request.game.createToken).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ cardName: 'Goblin', zone: Enriched.ZoneName.TABLE }),
    );
  });

  it('Mulligan same-size: HandContextMenu → mulligan with current hand count', async () => {
    const webClient = createMockWebClient();
    const state = buildGame({ localId: 1, opponentIds: [2] });
    // Seed the local hand with 5 cards so "same size" sends number: 5.
    const localPlayer = state.games.games[1].players[1];
    localPlayer.zones[Enriched.ZoneName.HAND] = makeZoneEntry({
      name: Enriched.ZoneName.HAND,
      cards: Array.from({ length: 5 }, (_, i) => makeCard({ id: 100 + i })),
      cardCount: 5,
    });
    renderWithProviders(<Game />, { preloadedState: state, webClient });

    fireEvent.contextMenu(screen.getByTestId('hand-zone'));
    fireEvent.click(await screen.findByText(/take mulligan \(same size\)/i));

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 5 });
  });

  it('Mulligan choose-size: negative input is translated to handSize + input', async () => {
    // Desktop's actMulligan (player_actions.cpp:308-354) treats 0 and
    // negative inputs as "relative to current hand size" before dispatching
    // Command_Mulligan. Regression guard for that convention.
    const webClient = createMockWebClient();
    const state = buildGame({ localId: 1, opponentIds: [2] });
    const localPlayer = state.games.games[1].players[1];
    localPlayer.zones[Enriched.ZoneName.HAND] = makeZoneEntry({
      name: Enriched.ZoneName.HAND,
      cards: Array.from({ length: 7 }, (_, i) => makeCard({ id: 100 + i })),
      cardCount: 7,
    });
    localPlayer.zones[Enriched.ZoneName.DECK] = makeZoneEntry({
      name: Enriched.ZoneName.DECK, cards: [], cardCount: 53,
    });
    renderWithProviders(<Game />, { preloadedState: state, webClient });

    fireEvent.contextMenu(screen.getByTestId('hand-zone'));
    fireEvent.click(await screen.findByText(/take mulligan \(choose size\)/i));

    expect(
      await screen.findByText('0 and lower are in comparison to current hand size.'),
    ).toBeInTheDocument();

    const input = screen.getByLabelText('New hand size');
    fireEvent.change(input, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 6 });
  });

  it('Mulligan choose-size: positive integer passes through unchanged', async () => {
    const webClient = createMockWebClient();
    const state = buildGame({ localId: 1, opponentIds: [2] });
    const localPlayer = state.games.games[1].players[1];
    localPlayer.zones[Enriched.ZoneName.HAND] = makeZoneEntry({
      name: Enriched.ZoneName.HAND,
      cards: Array.from({ length: 7 }, (_, i) => makeCard({ id: 100 + i })),
      cardCount: 7,
    });
    localPlayer.zones[Enriched.ZoneName.DECK] = makeZoneEntry({
      name: Enriched.ZoneName.DECK, cards: [], cardCount: 53,
    });
    renderWithProviders(<Game />, { preloadedState: state, webClient });

    fireEvent.contextMenu(screen.getByTestId('hand-zone'));
    fireEvent.click(await screen.findByText(/take mulligan \(choose size\)/i));

    const input = await screen.findByLabelText('New hand size');
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 4 });
  });

  it('Arrow-from-hand auto-plays the source card instead of sending a stale createArrow', async () => {
    // Desktop parity (card_item.cpp:243-250): dragging an arrow from a
    // local-hand card to a target outside the hand auto-plays the card.
    // The server re-keys the card id on the move, so sending createArrow
    // with the old hand cardId would be rejected. We resolve this as a
    // play-card intent and skip the arrow command.
    const webClient = createMockWebClient();
    const state = buildGame({
      localId: 1,
      opponentIds: [2],
      tableCards: [makeCard({ id: 50, name: 'Bear' })],
    });
    const localPlayer = state.games.games[1].players[1];
    localPlayer.zones[Enriched.ZoneName.HAND] = makeZoneEntry({
      name: Enriched.ZoneName.HAND,
      cards: [makeCard({ id: 10, name: 'Lightning Bolt' })],
      cardCount: 1,
    });
    renderWithProviders(<Game />, { preloadedState: state, webClient });

    const handCard = document.querySelector('[data-card-zone="hand"][data-card-id="10"]')!;
    fireEvent.contextMenu(handCard);

    const drawArrowItem = await screen.findByText('Draw arrow from here');
    fireEvent.click(drawArrowItem);

    const tableCard = document.querySelector('[data-card-zone="table"][data-card-id="50"]')!;
    fireEvent.click(tableCard);

    await waitFor(() => {
      expect(webClient.request.game.moveCard).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          startPlayerId: 1,
          startZone: Enriched.ZoneName.HAND,
          targetPlayerId: 1,
          targetZone: Enriched.ZoneName.TABLE,
          cardsToMove: { card: [{ cardId: 10 }] },
        }),
      );
    });
    expect(webClient.request.game.createArrow).not.toHaveBeenCalled();
  });

  it('Mulligan choose-size: value outside [-handSize, handSize+deckSize] is rejected', async () => {
    const webClient = createMockWebClient();
    const state = buildGame({ localId: 1, opponentIds: [2] });
    const localPlayer = state.games.games[1].players[1];
    localPlayer.zones[Enriched.ZoneName.HAND] = makeZoneEntry({
      name: Enriched.ZoneName.HAND,
      cards: Array.from({ length: 7 }, (_, i) => makeCard({ id: 100 + i })),
      cardCount: 7,
    });
    localPlayer.zones[Enriched.ZoneName.DECK] = makeZoneEntry({
      name: Enriched.ZoneName.DECK, cards: [], cardCount: 53,
    });
    renderWithProviders(<Game />, { preloadedState: state, webClient });

    fireEvent.contextMenu(screen.getByTestId('hand-zone'));
    fireEvent.click(await screen.findByText(/take mulligan \(choose size\)/i));

    const input = await screen.findByLabelText('New hand size');
    fireEvent.change(input, { target: { value: '-99' } });
    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    expect(webClient.request.game.mulligan).not.toHaveBeenCalled();
    expect(screen.getByText(/between -7 and 60/i)).toBeInTheDocument();
  });

  it('Sideboard: PlayerContextMenu → SideboardDialog → setSideboardPlan with the accumulated moveList', async () => {
    const webClient = createMockWebClient();
    const state = buildGame({ localId: 1, opponentIds: [2] });
    const localPlayer = state.games.games[1].players[1];
    localPlayer.zones[Enriched.ZoneName.DECK] = makeZoneEntry({
      name: Enriched.ZoneName.DECK,
      cards: [makeCard({ id: 100, name: 'Island' })],
      cardCount: 1,
    });
    localPlayer.zones[Enriched.ZoneName.SIDEBOARD] = makeZoneEntry({
      name: Enriched.ZoneName.SIDEBOARD,
      cards: [makeCard({ id: 200, name: 'Counterspell' })],
      cardCount: 1,
    });
    renderWithProviders(<Game />, { preloadedState: state, webClient });

    fireEvent.contextMenu(screen.getByTestId('player-info-1'));
    fireEvent.click(await screen.findByText(/view sideboard/i));
    fireEvent.click(await screen.findByRole('button', { name: /move Island to sideboard/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply plan/i }));

    expect(webClient.request.game.setSideboardPlan).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        moveList: [
          { cardName: 'Island', startZone: Enriched.ZoneName.DECK, targetZone: Enriched.ZoneName.SIDEBOARD },
        ],
      }),
    );
  });

  it('Sideboard lock: toggling Lock sideboard dispatches setSideboardLock', async () => {
    const webClient = createMockWebClient();
    renderWithProviders(<Game />, {
      preloadedState: buildGame({ localId: 1, opponentIds: [2] }),
      webClient,
    });

    fireEvent.contextMenu(screen.getByTestId('player-info-1'));
    fireEvent.click(await screen.findByText(/view sideboard/i));
    fireEvent.click(await screen.findByLabelText('Lock sideboard'));

    expect(webClient.request.game.setSideboardLock).toHaveBeenCalledWith(1, { locked: true });
  });

  it('changeZoneProperties: toggling "Always reveal top card" on local deck dispatches the command', async () => {
    const webClient = createMockWebClient();
    renderWithProviders(<Game />, {
      preloadedState: buildGame({ localId: 1, opponentIds: [2] }),
      webClient,
    });

    fireEvent.contextMenu(
      screen
        .getByTestId('player-board-1')
        .querySelector(`[data-testid="zone-stack-${Enriched.ZoneName.DECK}"]`)!,
    );
    fireEvent.click(await screen.findByText(/always reveal top card/i));

    expect(webClient.request.game.changeZoneProperties).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        zoneName: Enriched.ZoneName.DECK,
        alwaysRevealTopCard: true,
      }),
    );
  });
});
