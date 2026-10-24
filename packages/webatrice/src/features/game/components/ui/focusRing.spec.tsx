import { screen, within } from '@testing-library/react';
import { makeCard, makePlayerEntry, makePlayerProperties, makeGameEntry } from '@cockatrice/datatrice/testing';

import { makeStoreState, makeUser, renderWithProviders } from '../../../../__test-utils__';
import { buildSeatGameState, renderSeatCell } from '../../__test-utils__/seatFixtures';
import ChatLog from '../ChatLog/ChatLog';
import PhaseTrack from '../PhaseTrack/PhaseTrack';
import PlayerList from '../right-sidebar/PlayerList/PlayerList';
import { GAME_FOCUS_RING } from './focusRing';

vi.mock('../../../../services/cards/catalog/lookup', async () =>
  (await import('../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const RING = GAME_FOCUS_RING.split(' ');

describe('GAME_FOCUS_RING', () => {
  it('draws a 2px accent ring for keyboard focus only', () => {
    expect(RING).toEqual(expect.arrayContaining(['focus-visible:ring-2', 'focus-visible:ring-accent']));
    expect(RING.every((utility) => utility.startsWith('focus-visible:'))).toBe(true);
  });

  it('marks the seat\'s life total, mana counters and hand button', () => {
    renderSeatCell({ localPlayerId: 1, seats: [{ playerId: 1, name: 'Alice', hand: [makeCard({ id: 30, name: 'Forest' })] }] });
    expect(screen.getByRole('spinbutton', { name: 'Alice\'s life' })).toHaveClass(...RING);
    within(screen.getByRole('group', { name: 'Mana pool' })).getAllByRole('spinbutton')
      .forEach((pip) => expect(pip).toHaveClass(...RING));
    expect(screen.getByRole('button', { name: 'Hand — 1 card' })).toHaveClass(...RING);
  });

  it('marks the phase buttons, Pass, the chat box and the player rows\' action buttons', () => {
    const preloadedState = buildSeatGameState({ localPlayerId: 1, seats: [{ playerId: 1, name: 'Alice' }] });
    renderWithProviders(<><PhaseTrack /><ChatLog /></>, { preloadedState });
    within(screen.getByRole('navigation', { name: 'PhaseTrack.label' })).getAllByRole('button')
      .forEach((button) => expect(button).toHaveClass(...RING));
    expect(screen.getByRole('combobox', { name: 'ChatLog.inputLabel' })).toHaveClass(...RING);
  });

  it('marks the player list\'s "More actions" buttons', () => {
    const bob = makePlayerEntry({ properties: makePlayerProperties({ playerId: 2, userInfo: makeUser({ name: 'Bob' }) }) });
    renderWithProviders(<PlayerList />, {
      preloadedState: makeStoreState({ games: { games: { 1: makeGameEntry({ players: { 2: bob } }) } } }),
    });
    expect(screen.getByRole('button', { name: 'PlayerList.moreActions' })).toHaveClass(...RING);
  });
});
