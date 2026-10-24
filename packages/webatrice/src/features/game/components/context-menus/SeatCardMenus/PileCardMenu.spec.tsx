import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { chooseMenuPath, menuLabels, openMenus, renderSeatCell, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [{ playerId: 1, grave: [makeCard({ id: 40, name: 'Duress' }), makeCard({ id: 41, name: 'Opt' })] }, { playerId: 2 }],
};

function renderMenu() {
  return renderSeatCell(SPEC, 1, {
    gameDialogs: {
      seatCardMenu: {
        kind: 'pile',
        playerId: 1,
        zone: ZoneName.GRAVE,
        cardId: '41',
        cardName: 'Opt',
        x: 0,
        y: 0,
        viewCardIds: ['40', '41'],
        columnCardIds: ['41'],
      },
    },
  });
}

describe('PileCardMenu', () => {
  it('offers the zone-view card menu: arrow, clone, select all / column', () => {
    renderMenu();
    expect(menuLabels(openMenus()[0])).toEqual(['Draw arrow...', 'Clone', 'Select All', 'Select Column']);
  });

  it('clones the clicked card onto the own battlefield', () => {
    const { game } = renderMenu();
    chooseMenuPath('Clone');
    expect(vi.mocked(game.createToken).mock.calls.map(([, params]) => params.cardName)).toEqual(['Opt']);
  });
});
