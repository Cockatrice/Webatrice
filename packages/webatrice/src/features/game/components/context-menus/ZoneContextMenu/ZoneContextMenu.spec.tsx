import { ZoneName } from '@cockatrice/sockatrice';
import { screen, fireEvent } from '@testing-library/react';
import { createMockWebClient, makeStoreState, renderWithProviders } from '../../../../../__test-utils__';
import {
  makeGameEntry,
  makePlayerEntry,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import type { GameDialogs } from '../../../hooks/useGameDialogs';
import ZoneContextMenu from './ZoneContextMenu';

function stateWithDeckZone(overrides: Partial<ReturnType<typeof makeZoneEntry>> = {}) {
  const player = makePlayerEntry({
    zones: {
      deck: makeZoneEntry({ name: ZoneName.DECK, ...overrides }),
      grave: makeZoneEntry({ name: ZoneName.GRAVE }),
      rfg: makeZoneEntry({ name: ZoneName.EXILE }),
    },
  });
  return makeStoreState({
    games: {
      games: {
        1: makeGameEntry({ players: { 1: player } }),
      },
    },
  });
}

// ZoneContextMenu self-sources: zoneMenu state (which seat/zone, open) + the
// parent-owned action handlers come from GameDialogsContext.
function renderMenu(opts: {
  playerId?: number | null;
  zoneName?: string;
  zoneOverrides?: Partial<ReturnType<typeof makeZoneEntry>>;
  dialogs?: Partial<GameDialogs>;
  webClient?: ReturnType<typeof createMockWebClient>;
} = {}) {
  const playerId = opts.playerId === undefined ? 1 : opts.playerId;
  const zoneName = opts.zoneName ?? ZoneName.DECK;
  const zoneMenu =
    playerId != null ? { playerId, zoneName, anchorPosition: { top: 100, left: 100 } } : null;
  return renderWithProviders(<ZoneContextMenu />, {
    preloadedState: stateWithDeckZone(opts.zoneOverrides),
    webClient: opts.webClient,
    gameDialogs: { zoneMenu, ...opts.dialogs },
  });
}

describe('ZoneContextMenu', () => {
  it('does not render when there is no open zone menu', () => {
    renderMenu({ playerId: null });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('does not render for unsupported zones (e.g. hand, stack)', () => {
    renderMenu({ zoneName: ZoneName.HAND });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  describe('Deck zone', () => {
    it('renders every deck action when open', () => {
      renderMenu();

      expect(screen.getByText('Draw a card')).toBeInTheDocument();
      expect(screen.getByText('Draw N cards…')).toBeInTheDocument();
      expect(screen.getByText('Shuffle')).toBeInTheDocument();
      expect(screen.getByText('Dump top N…')).toBeInTheDocument();
      expect(screen.getByText('Reveal top card to all')).toBeInTheDocument();
      expect(screen.getByText('Reveal top N to…')).toBeInTheDocument();
      expect(screen.getByText('Always reveal top card')).toBeInTheDocument();
      expect(screen.getByText('Always look at top card')).toBeInTheDocument();
    });

    it('dispatches drawCards(1) on "Draw a card"', () => {
      const webClient = createMockWebClient();
      const closeZoneMenu = vi.fn();
      renderMenu({ webClient, dialogs: { closeZoneMenu } });

      fireEvent.click(screen.getByText('Draw a card'));

      expect(webClient.request.game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
      expect(closeZoneMenu).toHaveBeenCalled();
    });

    it('dispatches shuffle on the deck zone', () => {
      const webClient = createMockWebClient();
      renderMenu({ webClient });

      fireEvent.click(screen.getByText('Shuffle'));

      expect(webClient.request.game.shuffle).toHaveBeenCalledWith(1, {
        zoneName: ZoneName.DECK,
        start: 0,
        end: -1,
      });
    });

    it('dispatches revealCards(topCards=1, playerId=-1) on "Reveal top card to all"', () => {
      const webClient = createMockWebClient();
      renderMenu({ webClient });

      fireEvent.click(screen.getByText('Reveal top card to all'));

      expect(webClient.request.game.revealCards).toHaveBeenCalledWith(1, {
        zoneName: ZoneName.DECK,
        playerId: -1,
        topCards: 1,
      });
    });

    it('defers prompt-backed items to parent callbacks', () => {
      const handleRequestDrawN = vi.fn();
      const handleRequestDumpN = vi.fn();
      const handleRequestRevealTopN = vi.fn();
      renderMenu({ dialogs: { handleRequestDrawN, handleRequestDumpN, handleRequestRevealTopN } });

      fireEvent.click(screen.getByText('Draw N cards…'));
      expect(handleRequestDrawN).toHaveBeenCalled();

      fireEvent.click(screen.getByText('Dump top N…'));
      expect(handleRequestDumpN).toHaveBeenCalled();

      fireEvent.click(screen.getByText('Reveal top N to…'));
      expect(handleRequestRevealTopN).toHaveBeenCalled();
    });

    it('dispatches changeZoneProperties with the flipped alwaysRevealTopCard', () => {
      const webClient = createMockWebClient();
      renderMenu({ webClient, zoneOverrides: { alwaysRevealTopCard: false } });

      fireEvent.click(screen.getByText('Always reveal top card'));

      expect(webClient.request.game.changeZoneProperties).toHaveBeenCalledWith(1, {
        zoneName: ZoneName.DECK,
        alwaysRevealTopCard: true,
      });
    });

    it('dispatches changeZoneProperties with the flipped alwaysLookAtTopCard', () => {
      const webClient = createMockWebClient();
      renderMenu({ webClient, zoneOverrides: { alwaysLookAtTopCard: true } });

      fireEvent.click(screen.getByText('Always look at top card'));

      expect(webClient.request.game.changeZoneProperties).toHaveBeenCalledWith(1, {
        zoneName: ZoneName.DECK,
        alwaysLookAtTopCard: false,
      });
    });
  });

  describe('Graveyard / Exile zones', () => {
    it('offers "Reveal graveyard to…" on the grave zone', () => {
      const handleRequestRevealZone = vi.fn();
      renderMenu({ zoneName: ZoneName.GRAVE, dialogs: { handleRequestRevealZone } });

      fireEvent.click(screen.getByText('Reveal graveyard to…'));

      expect(handleRequestRevealZone).toHaveBeenCalled();
    });

    it('offers "Reveal exile to…" on the exile zone', () => {
      const handleRequestRevealZone = vi.fn();
      renderMenu({ zoneName: ZoneName.EXILE, dialogs: { handleRequestRevealZone } });

      fireEvent.click(screen.getByText('Reveal exile to…'));

      expect(handleRequestRevealZone).toHaveBeenCalled();
    });
  });
});
