import { act, fireEvent } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { makeCard } from '@cockatrice/datatrice/testing';

import { cardEl, renderSeatCell, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/cardCatalog', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const OWN_CARD = makeCard({ id: 10, name: 'Own card', tapped: false });
const FOREIGN_CARD = makeCard({ id: 20, name: 'Foreign card', tapped: false });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  judge: true,
  seats: [
    { playerId: 1, table: [OWN_CARD] },
    { playerId: 2, table: [FOREIGN_CARD] },
  ],
};

it('wraps a judge click-to-tap for the foreign card owner and updates only that owner optimistically', async () => {
  const { game, store } = renderSeatCell(SPEC, 2);

  await act(async () => {
    fireEvent.doubleClick(cardEl(FOREIGN_CARD.id, 'battlefield'));
  });

  expect(game.setCardAttr).toHaveBeenCalledWith(
    1,
    {
      zone: ZoneName.TABLE,
      cardId: FOREIGN_CARD.id,
      attribute: CardAttribute.AttrTapped,
      attrValue: '1',
    },
    2,
    { onError: expect.any(Function) },
  );
  const players = store.getState().games.games[1].players;
  expect(players[2].zones[ZoneName.TABLE].byId[FOREIGN_CARD.id].tapped).toBe(true);
  expect(players[1].zones[ZoneName.TABLE].byId[OWN_CARD.id].tapped).toBe(false);
});
