import { act, fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { games } from '@cockatrice/datatrice';
import { ZoneName } from '@cockatrice/sockatrice';
import {
  CardAttribute,
  Event_SetCounterSchema,
  ServerInfo_PlayerProperties_PlaymatParamsSchema,
} from '@cockatrice/sockatrice/generated';
import { makeCard } from '@cockatrice/datatrice/testing';

import { getSettings, settingsStore } from '../../../../../hooks/useSettings';
import {
  battlefieldEl,
  cardEl,
  LIFE_COUNTER_ID,
  menuLabels,
  openContextMenu,
  renderSeatCell,
  type SeatGameSpec,
} from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const BOLT = makeCard({ id: 10, name: 'Bolt', x: 3, y: 1 });
const OGRE = makeCard({ id: 11, name: 'Ogre', x: 0, y: 0, tapped: true });
const BEAR = makeCard({ id: 20, name: 'Bear', x: 0, y: 0 });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, table: [BOLT, OGRE] },
    { playerId: 2, table: [BEAR] },
  ],
};

describe('Battlefield', () => {
  it('renders the owner\'s board with each card addressable on the wire and tapped cards turned', () => {
    renderSeatCell(SPEC);
    expect(battlefieldEl(1)).toBeInTheDocument();
    expect(cardEl(BOLT.id, 'battlefield')).toHaveAttribute('data-card-owner', '1');
    expect(cardEl(BOLT.id, 'battlefield')).toHaveAttribute('data-card-zone', ZoneName.TABLE);
    expect(cardEl(OGRE.id, 'battlefield').style.transform).toBe('rotate(90deg)');
    expect(cardEl(BOLT.id, 'battlefield').style.transform).toBe('');
  });

  it('gives the owner desktop\'s player menu on the board, and another viewer the pile views', () => {
    renderSeatCell(SPEC);
    expect(menuLabels(openContextMenu(battlefieldEl(1))).slice(0, 5)).toEqual(['Hand', 'Library', 'Graveyard', 'Exile', 'Sideboard']);
  });

  it('gives another viewer only the graveyard and exile views and Tally on that board', () => {
    renderSeatCell(SPEC, 2);
    expect(menuLabels(openContextMenu(battlefieldEl(2)))).toEqual(['Graveyard', 'Exile', 'Tally']);
  });

  it('opens the seat\'s card menu on a card instead of the board menu', () => {
    const openSeatCardMenu = vi.fn();
    renderSeatCell(SPEC, 2, { gameDialogs: { openSeatCardMenu } });
    fireEvent.contextMenu(cardEl(BEAR.id, 'battlefield'), { clientX: 1, clientY: 2 });
    expect(openSeatCardMenu).toHaveBeenCalledWith({ kind: 'battlefield', playerId: 2, cardId: '20', x: 1, y: 2 });
  });

  it('taps and untaps an own card on double-click', () => {
    const { game } = renderSeatCell(SPEC);
    fireEvent.doubleClick(cardEl(OGRE.id, 'battlefield'));
    expect(vi.mocked(game.setCardAttr).mock.calls.map(([, params]) => params)).toEqual([
      { zone: ZoneName.TABLE, cardId: OGRE.id, attribute: CardAttribute.AttrTapped, attrValue: '0' },
    ]);
  });

  it('does not tap another player\'s card', () => {
    const { game } = renderSeatCell(SPEC, 2);
    fireEvent.doubleClick(cardEl(BEAR.id, 'battlefield'));
    expect(game.setCardAttr).not.toHaveBeenCalled();
  });

  describe('damage wash', () => {
    type Store = ReturnType<typeof renderSeatCell>['store'];
    const setLife = (store: Store, value: number) => act(() => {
      store.dispatch(games.Actions.counterSet({
        gameId: 1,
        playerId: 1,
        data: create(Event_SetCounterSchema, { counterId: LIFE_COUNTER_ID, value }),
      }));
    });
    const wash = () => screen.queryByTestId('value-flash-damage');

    afterEach(() => {
      settingsStore.reset();
    });

    it('washes the table on a loss and not on a gain', () => {
      const { store } = renderSeatCell(SPEC);
      setLife(store, 25);
      expect(wash()).not.toBeInTheDocument();
      setLife(store, 22);
      expect(wash()).toBeInTheDocument();
    });

    it('keeps a running wash through a gain, as desktop\'s shimmer keeps decaying', () => {
      const { store } = renderSeatCell(SPEC);
      setLife(store, 15);
      const running = wash();
      setLife(store, 16);
      expect(wash()).toBe(running);
    });

    it('stays still with "Battlefield flash on damage" off', async () => {
      const settings = await getSettings();
      settingsStore.setValue(Object.assign(settings, { animationsChosen: true, battlefieldFlash: false }));
      const { store } = renderSeatCell(SPEC);
      setLife(store, 12);
      expect(wash()).not.toBeInTheDocument();
    });

    it('skips the wash and the tap animation for a replay rewind', () => {
      let rewinds = 0;
      const { store } = renderSeatCell(SPEC, 1, { rewindCount: () => rewinds });
      expect(cardEl(OGRE.id, 'battlefield').style.transition).toBe('transform 150ms ease-out');

      rewinds++;
      setLife(store, 12);
      expect(wash()).not.toBeInTheDocument();
      expect(cardEl(OGRE.id, 'battlefield').style.transition).toBe('');

      setLife(store, 10);
      expect(wash()).toBeInTheDocument();
      expect(cardEl(OGRE.id, 'battlefield').style.transition).toBe('transform 150ms ease-out');
    });
  });

  describe('table background', () => {
    const island = { cardName: 'Island', cardProviderId: 'uuid-1', params: { marginPctL: 0, marginPctR: 0, verticalOffset: 0, zoom: 1 } };
    const playmat = create(ServerInfo_PlayerProperties_PlaymatParamsSchema, { cardName: 'Forest', cardProviderId: 'uuid-2', zoom: 1 });

    beforeEach(async () => {
      const settings = await getSettings();
      settingsStore.setValue(Object.assign(settings, { zoneBackgrounds: { table: island } }));
    });

    afterEach(() => {
      settingsStore.reset();
    });

    it('draws the table\'s zone background where there is no playmat', () => {
      renderSeatCell({ ...SPEC, server31: true });
      expect(screen.getByTestId('zone-background-table')).toBeInTheDocument();
      expect(screen.queryByTestId('player-playmat')).not.toBeInTheDocument();
    });

    it('draws only the playmat where there is one, as desktop does', () => {
      renderSeatCell({ ...SPEC, server31: true, seats: [{ ...SPEC.seats[0], playmat }, SPEC.seats[1]] });
      expect(screen.getByTestId('player-playmat')).toBeInTheDocument();
      expect(screen.queryByTestId('zone-background-table')).not.toBeInTheDocument();
    });
  });
});
