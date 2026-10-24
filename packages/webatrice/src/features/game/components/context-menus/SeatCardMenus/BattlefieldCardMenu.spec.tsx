import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { chooseMenuPath, menuLabels, openMenus, renderSeatCell, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const BOLT = makeCard({ id: 10, name: 'Bolt', x: 3, y: 1 });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, table: [BOLT] },
    { playerId: 2, table: [BEAR] },
  ],
};

function renderMenu(playerId: number, cardId: number) {
  const closeSeatCardMenu = vi.fn();
  const utils = renderSeatCell(SPEC, playerId, {
    gameDialogs: { seatCardMenu: { kind: 'battlefield', playerId, cardId: String(cardId), x: 10, y: 10 }, closeSeatCardMenu },
  });
  return { ...utils, closeSeatCardMenu };
}

describe('BattlefieldCardMenu', () => {
  it('renders nothing until this seat\'s battlefield menu is open', () => {
    renderSeatCell(SPEC, 1, { gameDialogs: { seatCardMenu: { kind: 'battlefield', playerId: 2, cardId: '20', x: 0, y: 0 } } });
    expect(openMenus()).toEqual([]);
  });

  it('gives the owner the full card menu, whose actions send the card\'s command and close it', () => {
    const { game, closeSeatCardMenu } = renderMenu(1, BOLT.id);
    expect(menuLabels(openMenus()[0]).slice(0, 2)).toEqual(['Tap / Untap', 'Skip untapping']);
    chooseMenuPath('Tap / Untap');
    expect(vi.mocked(game.setCardAttr).mock.calls[0][1]).toEqual({
      zone: ZoneName.TABLE,
      cardId: BOLT.id,
      attribute: CardAttribute.AttrTapped,
      attrValue: '1',
    });
    expect(closeSeatCardMenu).toHaveBeenCalled();
  });

  it('gives another player\'s card the viewer\'s menu, without the owner\'s actions', () => {
    renderMenu(2, BEAR.id);
    const labels = menuLabels(openMenus()[0]);
    expect(labels).toContain('Draw arrow...');
    expect(labels).not.toContain('Tap / Untap');
  });
});
