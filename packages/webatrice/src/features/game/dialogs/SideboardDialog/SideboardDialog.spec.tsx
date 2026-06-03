import { act, screen, fireEvent, within } from '@testing-library/react';
import { Enriched, games } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import { renderWithProviders } from '../../../../__test-utils__';
import type { GameDialogs } from '../../hooks/useGameDialogs';
import SideboardDialog, { applyMoves } from './SideboardDialog';

const DECK_CARDS = [
  makeCard({ id: 1, name: 'Island' }),
  makeCard({ id: 2, name: 'Mountain' }),
];
const SIDEBOARD_CARDS = [makeCard({ id: 10, name: 'Counterspell' })];

function makeLocalPlayer(opts: { sideboardLocked?: boolean; sideboard?: ReturnType<typeof makeCard>[] } = {}) {
  return makePlayerEntry({
    properties: makePlayerProperties({
      playerId: 1,
      sideboardLocked: opts.sideboardLocked ?? false,
      userInfo: { name: 'P1' },
    }),
    zones: {
      deck: makeZoneEntry({ name: Enriched.ZoneName.DECK, cards: DECK_CARDS }),
      sb: makeZoneEntry({ name: Enriched.ZoneName.SIDEBOARD, cards: opts.sideboard ?? SIDEBOARD_CARDS }),
    },
  });
}

// SideboardDialog self-sources: open state + submit/cancel/lock handlers from
// GameDialogsContext; player name, deck/sideboard cards, and lock flag from the
// local player in the store. sideboardOpen=true = open.
function render(
  opts: {
    dialogs?: Partial<GameDialogs>;
    sideboardLocked?: boolean;
    sideboard?: ReturnType<typeof makeCard>[];
  } = {},
) {
  const preloadedState = {
    games: {
      games: {
        1: makeGameEntry({
          localPlayerId: 1,
          players: { 1: makeLocalPlayer(opts) },
        }),
      },
    },
  };
  return renderWithProviders(<SideboardDialog />, {
    preloadedState,
    gameDialogs: { sideboardOpen: true, ...opts.dialogs },
  });
}

describe('SideboardDialog', () => {
  it('renders deck and sideboard columns with counts', () => {
    render();

    expect(screen.getByText(/main deck \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^sideboard \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText('Island')).toBeInTheDocument();
    expect(screen.getByText('Counterspell')).toBeInTheDocument();
  });

  it('moves a card from deck to sideboard when → is clicked (local draft only)', () => {
    const handleSideboardSubmit = vi.fn();
    render({ dialogs: { handleSideboardSubmit } });

    fireEvent.click(screen.getByRole('button', { name: /move Island to sideboard/i }));

    // Island now shown in the sideboard list; counts updated.
    expect(screen.getByText(/main deck \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/^sideboard \(2\)/i)).toBeInTheDocument();
    // No dispatch yet — Apply hasn't been clicked.
    expect(handleSideboardSubmit).not.toHaveBeenCalled();
  });

  it('submits the accumulated draft as a moveList when Apply is clicked', () => {
    const handleSideboardSubmit = vi.fn();
    render({ dialogs: { handleSideboardSubmit } });

    fireEvent.click(screen.getByRole('button', { name: /move Island to sideboard/i }));
    fireEvent.click(screen.getByRole('button', { name: /move Counterspell to main deck/i }));
    fireEvent.click(screen.getByRole('button', { name: /apply plan/i }));

    expect(handleSideboardSubmit).toHaveBeenCalledWith([
      { cardName: 'Island', startZone: Enriched.ZoneName.DECK, targetZone: Enriched.ZoneName.SIDEBOARD },
      { cardName: 'Counterspell', startZone: Enriched.ZoneName.SIDEBOARD, targetZone: Enriched.ZoneName.DECK },
    ]);
  });

  it('disables move buttons and Apply when the sideboard is locked', () => {
    render({ sideboardLocked: true });

    expect(screen.getByRole('button', { name: /move Island to sideboard/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move Counterspell to main deck/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /apply plan/i })).toBeDisabled();
    expect(screen.getByRole('note')).toHaveTextContent(/sideboard is locked/i);
  });

  it('dispatches the lock handler when the Lock checkbox changes', () => {
    const handleToggleSideboardLock = vi.fn();
    render({ dialogs: { handleToggleSideboardLock } });

    fireEvent.click(screen.getByLabelText('Lock sideboard'));
    expect(handleToggleSideboardLock).toHaveBeenCalledWith(true);
  });

  it('resets the draft when the sideboard is locked mid-edit (desktop resetSideboardPlan parity)', () => {
    const { store } = render();

    fireEvent.click(screen.getByRole('button', { name: /move Island to sideboard/i }));
    expect(screen.getByRole('button', { name: /apply plan \(1\)/i })).toBeInTheDocument();

    // Server locks the sideboard mid-edit; the lock flag flows through the store.
    act(() => {
      store.dispatch(
        games.Actions.gamePlayersReplaced({
          gameId: 1,
          players: { 1: makeLocalPlayer({ sideboardLocked: true }) },
        }),
      );
    });

    // Draft cleared — Apply label no longer carries a count and the lists
    // reflect the original wire snapshot.
    expect(screen.queryByRole('button', { name: /apply plan \(/i })).not.toBeInTheDocument();
    expect(screen.getByText(/main deck \(2\)/i)).toBeInTheDocument();
  });

  it('renders (empty) when a column has no cards', () => {
    render({ sideboard: [] });

    const sbList = screen.getByTestId('sideboard-dialog-sb');
    expect(within(sbList).getByText(/\(empty\)/)).toBeInTheDocument();
  });

  it('fires the close handler when the Cancel button is clicked', () => {
    const closeSideboard = vi.fn();
    render({ dialogs: { closeSideboard } });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(closeSideboard).toHaveBeenCalled();
  });
});

describe('applyMoves', () => {
  it('processes moves in order, identifying cards by name', () => {
    const deck = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const sb = [{ id: 3, name: 'C' }];

    const result = applyMoves(deck, sb, [
      { cardName: 'A', startZone: Enriched.ZoneName.DECK, targetZone: Enriched.ZoneName.SIDEBOARD },
      { cardName: 'C', startZone: Enriched.ZoneName.SIDEBOARD, targetZone: Enriched.ZoneName.DECK },
    ]);

    expect(result.deck.map((c) => c.name).sort()).toEqual(['B', 'C']);
    expect(result.sideboard.map((c) => c.name)).toEqual(['A']);
  });

  it('drops moves that reference cards not present in the source zone', () => {
    const deck = [{ id: 1, name: 'A' }];
    const result = applyMoves(deck, [], [
      { cardName: 'Missing', startZone: Enriched.ZoneName.DECK, targetZone: Enriched.ZoneName.SIDEBOARD },
    ]);

    expect(result.deck).toHaveLength(1);
    expect(result.sideboard).toHaveLength(0);
  });
});
