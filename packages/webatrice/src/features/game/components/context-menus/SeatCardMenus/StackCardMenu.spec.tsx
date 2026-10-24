import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { chooseMenuPath, menuLabels, openMenus, renderSeatCell, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, stack: [makeCard({ id: 50, name: 'Counterspell' })] },
    { playerId: 2, stack: [makeCard({ id: 51, name: 'Shock' })] },
  ],
};

const renderMenu = (playerId: number, cardId: number) => renderSeatCell(SPEC, playerId, {
  gameDialogs: { seatCardMenu: { kind: 'stack', playerId, cardId: String(cardId), x: 0, y: 0 } },
});

describe('StackCardMenu', () => {
  it('gives the owner desktop\'s stack menu, and moving a card sends it', () => {
    const { game } = renderMenu(1, 50);
    expect(menuLabels(openMenus()[0]).slice(0, 3)).toEqual(['Play', 'Play Face Down', 'Clone']);
    chooseMenuPath('Move to', 'Graveyard');
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: ZoneName.STACK,
      cardsToMove: { card: [{ cardId: 50 }] },
      targetZone: ZoneName.GRAVE,
    });
  });

  it('gives another player\'s stack card only the viewer\'s items', () => {
    renderMenu(2, 51);
    expect(menuLabels(openMenus()[0])).toEqual(['Draw arrow...', 'Clone', 'Select All']);
  });
});
