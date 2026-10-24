import { act, fireEvent, waitFor } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard } from '@cockatrice/datatrice/testing';

import { lookupCard } from '../../../../../services/cards/catalog/lookup';
import { cardEl, renderSeatCell, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const SHOCK = makeCard({ id: 50, name: 'Shock' });
const BEAR = makeCard({ id: 51, name: 'Bear' });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, stack: [SHOCK, BEAR] },
    { playerId: 2, stack: [makeCard({ id: 60, name: 'Counterspell' })] },
  ],
};

const found = (name: string, typeLine: string) =>
  ({ found: true, source: 'scryfall', name, typeLine, printings: [] }) as Awaited<ReturnType<typeof lookupCard>>;

afterEach(() => {
  vi.mocked(lookupCard).mockImplementation(async (name: string) =>
    ({ found: false, source: 'unknown', name, printings: [] }) as Awaited<ReturnType<typeof lookupCard>>);
});

describe('StackColumn', () => {
  it('lists the stack\'s cards, addressable as arrow sources and targets', () => {
    renderSeatCell(SPEC);
    expect(cardEl(SHOCK.id, 'stack')).toHaveAttribute('data-card-zone', ZoneName.STACK);
    expect(cardEl(BEAR.id, 'stack')).toHaveAttribute('data-card-owner', '1');
  });

  it('opens the seat\'s stack card menu on right-click, on any seat', () => {
    const openSeatCardMenu = vi.fn();
    renderSeatCell(SPEC, 2, { gameDialogs: { openSeatCardMenu } });
    fireEvent.contextMenu(cardEl(60, 'stack'), { clientX: 5, clientY: 6 });
    expect(openSeatCardMenu).toHaveBeenCalledWith({ kind: 'stack', playerId: 2, cardId: '60', x: 5, y: 6 });
  });

  it('resolves an own instant to the graveyard and anything else to the battlefield on double-click', async () => {
    const { game } = renderSeatCell(SPEC);
    vi.mocked(lookupCard).mockResolvedValueOnce(found('Shock', 'Instant'));
    fireEvent.doubleClick(cardEl(SHOCK.id, 'stack'));
    await waitFor(() => expect(game.moveCard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: ZoneName.STACK,
      cardsToMove: { card: [{ cardId: SHOCK.id }] },
      targetZone: ZoneName.GRAVE,
    });

    vi.mocked(lookupCard).mockResolvedValueOnce(found('Bear', 'Creature — Bear'));
    fireEvent.doubleClick(cardEl(BEAR.id, 'stack'));
    await waitFor(() => expect(game.moveCard).toHaveBeenCalledTimes(2));
    expect(vi.mocked(game.moveCard).mock.calls[1][1]).toMatchObject({ startZone: ZoneName.STACK, targetZone: ZoneName.TABLE });
  });

  it('resolves a creature to the battlefield with its seat metadata P/T and cipt', async () => {
    vi.mocked(lookupCard).mockImplementation(async (name: string) =>
      ({ ...found(name, 'Creature — Bear'), power: '2', toughness: '2', cipt: true }) as Awaited<ReturnType<typeof lookupCard>>);
    const { game } = renderSeatCell(SPEC);
    await waitFor(() => expect(lookupCard).toHaveBeenCalledWith('Bear'));
    await act(async () => {});
    vi.mocked(lookupCard).mockClear();

    fireEvent.doubleClick(cardEl(BEAR.id, 'stack'));
    await waitFor(() => expect(game.moveCard).toHaveBeenCalledTimes(1));
    expect(lookupCard).not.toHaveBeenCalled();
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startZone: ZoneName.STACK,
      targetZone: ZoneName.TABLE,
      cardsToMove: { card: [{ cardId: BEAR.id, pt: '2/2', tapped: true }] },
    });
  });

  it('plays nothing from another player\'s stack', () => {
    const { game } = renderSeatCell(SPEC, 2);
    fireEvent.doubleClick(cardEl(60, 'stack'));
    expect(game.moveCard).not.toHaveBeenCalled();
  });

  it('lets a judge play from another player\'s stack, as desktop\'s getLocalOrJudge does', async () => {
    const { game } = renderSeatCell({ ...SPEC, judge: true }, 2);
    vi.mocked(lookupCard).mockResolvedValueOnce(found('Counterspell', 'Instant'));
    fireEvent.doubleClick(cardEl(60, 'stack'));
    await waitFor(() => expect(game.moveCard).toHaveBeenCalledTimes(1));
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({
      startPlayerId: 2,
      startZone: ZoneName.STACK,
      cardsToMove: { card: [{ cardId: 60 }] },
      targetZone: ZoneName.GRAVE,
    });
  });
});
