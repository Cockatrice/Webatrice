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

// Layout pulls in LeftNav which is not under test here; stub to a no-op.
vi.mock('../../components/Layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Block TurnControls' / Battlefield's Dexie-backed useSettings from firing
// an async settle after mount (would produce an unwrapped React state update).
vi.mock('../../hooks/useSettings');

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

  // Removed: `player-board-N`, `hand-zone`, `card-slot`, and the
  // `.player-board--mirrored` class no longer exist on the rendered tree —
  // GameBoardCell now delegates the entire per-seat surface (info panel,
  // stack column, battlefield, inline hand, mirroring) to the monolithic
  // PlayerBox component from the fancy-webatrice redo, which owns its own
  // Tailwind DOM and exposes no equivalent semantic testids. The
  // per-seat/hand-mode/hover behaviors these tests pinned are covered
  // more directly by useGameBoardLayout.spec.ts and PlayerBox's own suite.

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
      expect(screen.getByLabelText('deck list')).toBeInTheDocument();
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

      expect(screen.queryByRole('button', { name: /close zone view/i })).not.toBeInTheDocument();
    });

    // Removed: the zone-stack click affordance now lives inside PlayerBox
    // and is no longer reachable via `[data-testid="zone-stack-<name>"]`.
    // ZoneViewDialog open/close/opp-grave are covered by
    // ZoneViewDialog.spec.tsx and useGameDialogs.spec.tsx directly.
  });

  // Card-interaction tests removed: they all required `[data-testid="card-slot"]`
  // + `[data-testid="zone-stack-<name>"]` + `[data-testid="player-board-N"]`
  // hooks that PlayerBox (the current seat renderer) does not expose. The
  // command-dispatch paths themselves (bulkTap, drawCards, bulkSetPT,
  // context-menu open/close) are covered directly by the useGameDialogs and
  // context-menu component specs — those don't depend on the PlayerBox DOM.

  // M4–M6 orchestration tests live in Game.orchestration.spec.tsx — that
  // file pins the end-to-end dispatch flows (dialog/menu → command) that go
  // through Game.tsx state wiring. Splitting them out lets vitest's threads
  // pool run them in parallel with the unit-style tests in this file.

});
