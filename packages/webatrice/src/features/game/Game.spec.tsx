import { ZoneName } from '@cockatrice/sockatrice';
import { screen } from '@testing-library/react';
import { makeStoreState, renderWithProviders, connectedState, makeUser } from '../../__test-utils__';
import {
  makeCard,
  makeGameEntry,
  makeGameInfo,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import Game from './Game';
import { battlefieldEl, chooseMenuPath, openContextMenu, pileEl } from './__test-utils__/seatFixtures';

// Layout pulls in LeftNav which is not under test here; stub to a no-op.
vi.mock('../../components/Layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Block TurnControls' / Battlefield's Dexie-backed useSettings from firing
// an async settle after mount (would produce an unwrapped React state update).
vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/catalog/lookup', () => {
  const unknown = (name: string) => ({ found: false, source: 'unknown', name, printings: [] });
  return {
    lookupCard: vi.fn(async (name: string) => unknown(name)),
    lookupCards: vi.fn(async (inputs: Array<string | { name: string }>) =>
      new Map(inputs.map((i) => {
        const name = typeof i === 'string' ? i : i.name;
        return [name, unknown(name)];
      }))),
    lookupCardsCached: vi.fn(async (names: string[]) => new Map(names.map((n) => [n, unknown(n)]))),
    fetchAllPrintings: vi.fn(async () => []),
  };
});

interface BuildGameOpts {
  localId: number;
  opponentIds: number[];
  tableCards?: ReturnType<typeof makeCard>[];
  started?: boolean;
  spectator?: boolean;
  judge?: boolean;
  omniscient?: boolean;
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
  omniscient = false,
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
        [ZoneName.TABLE]: makeZoneEntry({
          name: ZoneName.TABLE,
          cards: pid === localId ? tableCards : [],
          cardCount: pid === localId ? tableCards.length : 0,
        }),
        [ZoneName.HAND]: makeZoneEntry({ name: ZoneName.HAND }),
        [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK, cardCount: 40 }),
        [ZoneName.GRAVE]: makeZoneEntry({
          name: ZoneName.GRAVE,
          cards: pid === localId ? graveCards : [],
          cardCount: pid === localId ? graveCards.length : 0,
        }),
        [ZoneName.EXILE]: makeZoneEntry({ name: ZoneName.EXILE }),
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
          info: makeGameInfo({ spectatorsOmniscient: omniscient }),
        }),
      },
    },
  });
}

describe('Game container', () => {
  it('shows the empty-game placeholder when no game is active', () => {
    renderWithProviders(<Game />, {
      preloadedState: makeStoreState({
        ...connectedState,
        games: { games: {} },
      }),
    });

    expect(screen.getByTestId('game-empty')).toBeInTheDocument();
    expect(screen.getByTestId('phase-bar')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  it('renders one battlefield per seat and mirrors every board above the local one', () => {
    renderWithProviders(<Game />, {
      preloadedState: buildGame({
        localId: 1,
        opponentIds: [2],
        tableCards: [makeCard({ id: 42, name: 'Bolt', x: 0, y: 0 })],
      }),
    });

    expect(battlefieldEl(1)).toHaveAttribute('data-battlefield-mirrored', 'false');
    expect(battlefieldEl(2)).toHaveAttribute('data-battlefield-mirrored', 'true');
    expect(battlefieldEl(1).querySelector('[data-card-id="42"]')).toHaveAttribute('data-card-owner', '1');
    expect(battlefieldEl(2).querySelector('[data-card]')).toBeNull();
  });

  it('keeps the phase bar and right panel visible when no game is joined', () => {
    renderWithProviders(<Game />, {
      preloadedState: makeStoreState({
        ...connectedState,
        games: { games: {} },
      }),
    });

    expect(screen.getByTestId('phase-bar')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  describe('DeckSelectDialog auto-open', () => {
    it('opens automatically when game is not started and local player is not ready', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({
          localId: 1,
          opponentIds: [2],
          started: false,
          localReadyStart: false,
        }),
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('Deck list')).toBeInTheDocument();
    });

    it('stays closed when the game has already started', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({
          localId: 1,
          opponentIds: [2],
          started: true,
          localReadyStart: false,
        }),
      });

      expect(screen.queryByLabelText('deck list')).not.toBeInTheDocument();
    });

    it('stays closed once the local player is ready', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({
          localId: 1,
          opponentIds: [2],
          started: false,
          localReadyStart: true,
        }),
      });

      expect(screen.queryByLabelText('deck list')).not.toBeInTheDocument();
    });

    it('stays closed for spectators', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({
          localId: 1,
          opponentIds: [2],
          started: false,
          spectator: true,
        }),
      });

      expect(screen.queryByLabelText('deck list')).not.toBeInTheDocument();
    });

    it('stays closed for judges', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({
          localId: 1,
          opponentIds: [2],
          started: false,
          judge: true,
        }),
      });

      expect(screen.queryByLabelText('deck list')).not.toBeInTheDocument();
    });

    // Judges on Servatrice are flagged spectator on the wire. Both gates
    // independently suppress the deck-select dialog; this pins that either
    // one alone is sufficient.
    it('stays closed for judges who are also flagged as spectators', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({
          localId: 1,
          opponentIds: [2],
          started: false,
          judge: true,
          spectator: true,
        }),
      });

      expect(screen.queryByLabelText('deck list')).not.toBeInTheDocument();
    });
  });

  describe('ZoneViewDialog', () => {
    it('is closed by default', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({ localId: 1, opponentIds: [2] }),
      });

      expect(screen.queryByRole('heading', { name: /^Graveyard — |'s library/ })).not.toBeInTheDocument();
    });

    it('opens one game-level zone view from "View graveyard"', () => {
      renderWithProviders(<Game />, {
        preloadedState: buildGame({
          localId: 1,
          opponentIds: [2],
          graveCards: [makeCard({ id: 7, name: 'Opt' })],
        }),
      });

      openContextMenu(pileEl('Graveyard', 0));
      chooseMenuPath('View graveyard');

      expect(screen.getAllByRole('heading', { name: /^Graveyard — P1/ })).toHaveLength(1);
    });
  });

});
