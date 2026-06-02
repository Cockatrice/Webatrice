import { act, fireEvent, waitFor, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Command_DumpZone_ext, Command_MoveCard_ext } from '@cockatrice/sockatrice/generated';
import { games } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { Game } from '@app/features/game';
import { store, connectRaw } from '../../helpers/setup';
import { renderFeatureScreen } from '../helpers';
import { findLastGameCommand } from '../../helpers/command-capture';
import { buildEventGameJoined, buildEventGameStateChanged, registerGameBoardHooks } from './helpers';

registerGameBoardHooks();

const GAME_ID = 42;

// Renders the board, opens the local "View library" popup (which fires the dump
// command), then feeds the Response_DumpZone snapshot in so the popup lists the
// cards — mirrors the real flow without a server or browser.
async function renderWithLibraryPopup(
  cards: ReturnType<typeof makeCard>[],
): Promise<{ dialog: HTMLElement; dumpCommandSent: boolean }> {
  connectRaw();
  renderFeatureScreen(<Game />);

  act(() => {
    store.dispatch(games.Actions.gameJoined({ data: buildEventGameJoined({ gameId: GAME_ID, localPlayerId: 1, hostId: 1 }) }));
    store.dispatch(games.Actions.gameStateChanged({ gameId: GAME_ID, data: buildEventGameStateChanged([1, 2], 1) }));
  });
  await screen.findByTestId('player-board-1');

  const deckStack = screen
    .getByTestId('player-board-1')
    .querySelector('[data-testid="zone-stack-deck"]') as HTMLElement;
  fireEvent.click(deckStack);

  const dumpCommandSent = findLastGameCommand(Command_DumpZone_ext).value.zoneName === 'deck';

  // Server's Response_DumpZone arrives → snapshot routed into the store.
  act(() => {
    store.dispatch(games.Actions.zoneViewRevealed({ gameId: GAME_ID, playerId: 1, zoneName: 'deck', cards }));
  });

  const dialog = await screen.findByTestId('zone-view-dialog');
  return { dialog, dumpCommandSent };
}

describe('View library popup', () => {
  it('sends a dump command on open and a popup card move emits a deck→graveyard moveCard', async () => {
    const { dialog, dumpCommandSent } = await renderWithLibraryPopup([
      makeCard({ id: 0, name: 'Forest' }),
      makeCard({ id: 1, name: 'Island' }),
      makeCard({ id: 2, name: 'Mountain' }),
    ]);
    expect(dumpCommandSent).toBe(true);
    expect(within(dialog).getByTestId('zone-view-card-0')).toBeInTheDocument();

    const slot = within(dialog)
      .getByTestId('zone-view-card-0')
      .querySelector('[data-testid="card-slot"]') as HTMLElement;
    fireEvent.contextMenu(slot);

    const menu = await screen.findByTestId('card-context-menu');
    fireEvent.click(within(menu).getByText('Send to Graveyard'));

    const cmd = findLastGameCommand(Command_MoveCard_ext);
    expect(cmd.gameId).toBe(GAME_ID);
    expect(cmd.value.startZone).toBe('deck');
    expect(cmd.value.targetZone).toBe('grave');
    expect(cmd.value.startPlayerId).toBe(1);
    // Non-table move routes to the card's owner tree (here owner === local).
    expect(cmd.value.targetPlayerId).toBe(1);
    expect(cmd.value.cardsToMove?.card[0]?.cardId).toBe(0);
  });

  it('prunes and re-indexes the open library popup when a card moves out of the deck', async () => {
    const { dialog } = await renderWithLibraryPopup([
      makeCard({ id: 0, name: 'Forest' }),
      makeCard({ id: 1, name: 'Island' }),
      makeCard({ id: 2, name: 'Mountain' }),
    ]);

    // A move-out event for the middle card (HiddenZone source → position carries the index).
    act(() => {
      store.dispatch(games.Actions.cardMoved({
        gameId: GAME_ID,
        playerId: 1,
        data: {
          cardId: 100, cardName: 'Island', startPlayerId: 1, startZone: 'deck', position: 1,
          targetPlayerId: 1, targetZone: 'hand', x: 0, y: 0, newCardId: -1, faceDown: false, newCardProviderId: '',
        },
      }));
    });

    // Island (index 1) is gone; survivors re-indexed to 0..1 (Forest, Mountain).
    await waitFor(() => {
      expect(within(dialog).queryByTestId('zone-view-card-2')).toBeNull();
    });
    expect(within(dialog).getByTestId('zone-view-card-0')).toHaveTextContent('Forest');
    expect(within(dialog).getByTestId('zone-view-card-1')).toHaveTextContent('Mountain');
    expect(within(dialog).queryByText('Island')).toBeNull();
  });
});
