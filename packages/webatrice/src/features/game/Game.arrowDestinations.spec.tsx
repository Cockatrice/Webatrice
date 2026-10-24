import { act, fireEvent } from '@testing-library/react';
import { games } from '@cockatrice/datatrice';
import { makeCard } from '@cockatrice/datatrice/testing';
import { ZoneName } from '@cockatrice/sockatrice';

import { createMockWebClient, renderWithProviders } from '../../__test-utils__';
import { battlefieldEl, buildSeatGameState, cardEl, chooseMenuPath, openContextMenu, pileEl } from './__test-utils__/seatFixtures';
import Game from './Game';

vi.mock('../../hooks/useSettings');

vi.mock('../../services/cards/cardCatalog', () => {
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

vi.mock('../../services/dexie/DexieDTOs/CardDTO', () => ({
  CardDTO: { get: vi.fn(async () => ({ tablerow: { value: '1' } })) },
}));

const nonPublicZones = [ZoneName.DECK, ZoneName.SIDEBOARD, ZoneName.HAND];
const picks = nonPublicZones.flatMap((zone) => [[zone, 'click'], [zone, 'Enter']] as const);

it.each(picks)('cancels a hand arrow on a non-public %s card (%s) without playing', async (zone, how) => {
  const webClient = createMockWebClient();
  const { store } = renderWithProviders(<Game />, {
    webClient,
    preloadedState: buildSeatGameState({
      localPlayerId: 1,
      seats: [
        { playerId: 1, hand: [makeCard({ id: 30, name: 'Shock' }), makeCard({ id: 31, name: 'Opt' })], sideboardCount: 1 },
        { playerId: 2, table: [makeCard({ id: 20, name: 'Bear' })] },
      ],
    }),
  });
  if (zone !== ZoneName.HAND) {
    if (zone === ZoneName.DECK) {
      openContextMenu(pileEl('Library', 0));
      chooseMenuPath('View library');
    } else {
      openContextMenu(battlefieldEl(1));
      chooseMenuPath('Sideboard', 'View sideboard');
    }
    act(() => {
      store.dispatch(games.Actions.zoneViewRevealed({
        gameId: 1, playerId: 1, zoneName: zone, cards: [makeCard({ id: 0, name: 'Island' })], isReversed: false,
      }));
    });
  }
  openContextMenu(cardEl(30, 'hand'));
  chooseMenuPath('Draw arrow...');
  const target = document.querySelector(`[data-card-zone="${zone}"][data-card-id="${zone === ZoneName.HAND ? 31 : 0}"]`);
  expect(target).not.toBeNull();
  await act(async () => {
    if (how === 'click') {
      fireEvent.click(target!);
    } else {
      (target as HTMLElement).focus();
      fireEvent.keyDown(target!, { key: 'Enter', code: 'Enter' });
    }
  });
  expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
  expect(webClient.request.game.createArrow).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(cardEl(20, 'battlefield'));
  });
  expect(webClient.request.game.moveCard).not.toHaveBeenCalled();
  expect(webClient.request.game.createArrow).not.toHaveBeenCalled();
});
