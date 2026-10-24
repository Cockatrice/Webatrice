import { ZoneName } from '@cockatrice/sockatrice';

import {
  intendedBattlefieldSlots,
  isSeatDragSource,
  isSeatDropZone,
  planSeatMove,
  seatDropAccepts,
  type SeatDragSource,
  type SeatDropTarget,
  type SeatDropZone,
} from './seatDropPlan';

const GRID = { rows: 3, cols: 8 };

function source(overrides: Partial<SeatDragSource> = {}): SeatDragSource {
  return { kind: 'seat', seatPlayerId: 1, zone: 'hand', cards: [{ id: '30' }], ...overrides };
}

const battlefield = (playerId: number, row = 0, col = 2): SeatDropTarget =>
  ({ zone: 'battlefield', playerId, slot: { row, col }, grid: GRID });

describe('planSeatMove', () => {
  it('moves a custom-zone card using its exact wire zone while retaining fixed-zone mappings', () => {
    const custom = source({ zone: { kind: 'custom', name: 'command' } });
    expect(planSeatMove(custom, { zone: 'hand', index: 0 })).toEqual([
      expect.objectContaining({ startZone: 'command', targetZone: ZoneName.HAND, cardsToMove: { card: [{ cardId: 30 }] } }),
    ]);
    expect(planSeatMove(custom, battlefield(2))[0]).toMatchObject({ startZone: 'command', targetZone: ZoneName.TABLE, targetPlayerId: 2 });
  });

  it('moves a hand card onto a battlefield stack column and lets the move path pick the sub-slot', () => {
    expect(planSeatMove(source(), battlefield(1, 1, 2))).toEqual([{
      startPlayerId: 1,
      startZone: ZoneName.HAND,
      cardsToMove: { card: [{ cardId: 30 }] },
      targetPlayerId: 1,
      targetZone: ZoneName.TABLE,
      x: 6,
      y: 1,
      isReversed: false,
    }]);
  });

  it('gifts onto another seat\'s battlefield as one command for the whole group', () => {
    const group = source({ zone: 'battlefield', cards: [{ id: '10', slot: { row: 0, col: 0 } }, { id: '11', slot: { row: 0, col: 1 } }] });
    expect(planSeatMove(group, battlefield(2, 2, 0))).toEqual([
      expect.objectContaining({
        startZone: ZoneName.TABLE,
        cardsToMove: { card: [{ cardId: 10 }, { cardId: 11 }] },
        targetPlayerId: 2,
        x: 0,
        y: 2,
      }),
    ]);
  });

  it('re-slots on the dragging seat\'s own battlefield one card at a time, keeping the group shape', () => {
    const group = source({ zone: 'battlefield', cards: [{ id: '10', slot: { row: 0, col: 0 } }, { id: '11', slot: { row: 1, col: 1 } }] });
    const plan = planSeatMove(group, battlefield(1, 0, 4));
    expect(plan.map((p) => [p.cardsToMove?.card?.[0]?.cardId, p.x, p.y])).toEqual([[10, 12, 0], [11, 15, 1]]);
    expect(plan[0]).not.toHaveProperty('isReversed');
  });

  const attachedForeign = source({
    seatPlayerId: 2,
    zone: 'battlefield',
    cards: [{ id: '12', slot: { row: 0, col: 1 }, ownerPlayerId: 1 }],
  });

  it('moves a card attached across seats out of its owner\'s table', () => {
    expect(planSeatMove(attachedForeign, { zone: 'graveyard' })).toEqual([{
      startPlayerId: 1,
      startZone: ZoneName.TABLE,
      cardsToMove: { card: [{ cardId: 12 }] },
      targetPlayerId: 1,
      targetZone: ZoneName.GRAVE,
      x: 0,
      y: 0,
      isReversed: false,
    }]);
  });

  it('drops a card attached across seats on the board that shows it as a move from its owner\'s table', () => {
    expect(planSeatMove(attachedForeign, battlefield(2, 1, 3))).toEqual([{
      startPlayerId: 1,
      startZone: ZoneName.TABLE,
      cardsToMove: { card: [{ cardId: 12 }] },
      targetPlayerId: 2,
      targetZone: ZoneName.TABLE,
      x: 9,
      y: 1,
      isReversed: false,
    }]);
  });

  it.each<[string, Partial<SeatDragSource>, SeatDropTarget, number]>([
    ['hand reorder at the insertion index', { zone: 'hand' }, { zone: 'hand', index: 1 }, 1],
    ['stack insert at the index', { zone: 'hand' }, { zone: 'stack', index: 2 }, 2],
    ['pile drop', { zone: 'hand' }, { zone: 'graveyard' }, 0],
    ['sideboard append', { zone: 'graveyard' }, { zone: 'sideboard' }, -1],
    ['library reveal reorder at the deck position', { zone: 'library', cards: [{ id: '2' }] }, { zone: 'library', position: 5 }, 5],
  ])('%s → x', (_label, from, target, x) => {
    expect(planSeatMove(source(from), target)).toEqual([expect.objectContaining({ x })]);
  });

  it('reorders a hand group one card at a time so it keeps its order', () => {
    const group = source({ cards: [{ id: '30' }, { id: '31' }] });
    const plan = planSeatMove(group, { zone: 'hand', index: 1, order: ['30', '31', '32'] });
    expect(plan.map((p) => [p.cardsToMove?.card?.[0]?.cardId, p.startZone, p.targetZone, p.x])).toEqual([
      [30, ZoneName.HAND, ZoneName.HAND, 2],
      [31, ZoneName.HAND, ZoneName.HAND, 2],
    ]);
  });

  it.each<[string, Partial<SeatDragSource>, SeatDropTarget]>([
    ['graveyard onto itself', { zone: 'graveyard' }, { zone: 'graveyard' }],
    ['stack onto itself', { zone: 'stack' }, { zone: 'stack', index: 0 }],
    ['library pile onto itself', { zone: 'library' }, { zone: 'library' }],
    ['sideboard onto itself', { zone: 'sideboard' }, { zone: 'sideboard' }],
    ['a lent card anywhere but a battlefield', { zone: 'library', lenderPlayerId: 2 }, { zone: 'graveyard' }],
    ['a public card without a server id', { zone: 'hand', cards: [{ id: 'local-1' }] }, { zone: 'graveyard' }],
    ['nothing', { cards: [] }, { zone: 'graveyard' }],
  ])('sends nothing for %s', (_label, from, target) => {
    expect(planSeatMove(source(from), target)).toEqual([]);
  });

  it('lands a card entering the battlefield with its printed P/T, and only then', () => {
    const fromHand = source({ cards: [{ id: '30', printedPT: '2/2' }, { id: '31' }] });
    expect(planSeatMove(fromHand, battlefield(2))[0].cardsToMove).toEqual({ card: [{ cardId: 30, pt: '2/2' }, { cardId: 31 }] });
    expect(planSeatMove(fromHand, { zone: 'graveyard' })[0].cardsToMove).toEqual({ card: [{ cardId: 30 }, { cardId: 31 }] });

    const onBoard = source({ zone: 'battlefield', cards: [{ id: '10', slot: { row: 0, col: 1 }, printedPT: '2/2' }] });
    expect(planSeatMove(onBoard, battlefield(2))[0].cardsToMove).toEqual({ card: [{ cardId: 10 }] });
  });

  it('addresses hidden zones by position: the pile\'s top card is 0', () => {
    const pile = source({ zone: 'library', cards: [{ id: 'library-top' }] });
    expect(planSeatMove(pile, { zone: 'graveyard' })).toEqual([
      expect.objectContaining({ startZone: ZoneName.DECK, cardsToMove: { card: [{ cardId: 0 }] } }),
    ]);
  });

  it('starts a lent drag in the lender\'s zone', () => {
    const lent = source({ zone: 'library', lenderPlayerId: 2, cards: [{ id: '3' }] });
    expect(planSeatMove(lent, battlefield(1))).toEqual([
      expect.objectContaining({ startPlayerId: 2, startZone: ZoneName.DECK, cardsToMove: { card: [{ cardId: 3 }] }, targetPlayerId: 1 }),
    ]);
  });

  it('lands a lent card only on the borrower\'s battlefield, unless a judge moves it (cmdMoveCard)', () => {
    const lent = source({ zone: 'library', lenderPlayerId: 2, cards: [{ id: '3' }] });
    expect(planSeatMove(lent, battlefield(2))).toEqual([]);
    expect(planSeatMove(lent, battlefield(3))).toEqual([]);
    expect(planSeatMove(lent, battlefield(3), { judge: true })).toEqual([
      expect.objectContaining({ startPlayerId: 2, targetPlayerId: 3, targetZone: ZoneName.TABLE }),
    ]);
  });

  describe('a move within the library', () => {
    const replay = (library: string[], plan: ReturnType<typeof planSeatMove>) => {
      const order = library.slice();
      for (const params of plan) {
        const cards = params.cardsToMove!.card!.map((card) => card.cardId!).sort((a, b) => a - b).map((p) => order[p]);
        cards.forEach((card, k) => {
          order.splice(order.indexOf(card), 1);
          order.splice(params.x! + k, 0, card);
        });
      }
      return order;
    };
    const libraryMove = (positions: number[], position: number) => planSeatMove(
      source({ zone: 'library', cards: positions.map((p) => ({ id: String(p) })) }),
      { zone: 'library', position },
    );

    it('keeps an adjacent group together and in order at the chosen place', () => {
      expect(replay(['A', 'B', 'C', 'D'], libraryMove([0, 1], 2))).toEqual(['C', 'D', 'A', 'B']);
      expect(replay(['A', 'B', 'C', 'D'], libraryMove([2, 3], 0))).toEqual(['C', 'D', 'A', 'B']);
    });

    it('gathers a group with gaps at the chosen place, in its order', () => {
      expect(replay(['A', 'B', 'C', 'D', 'E'], libraryMove([0, 2], 2))).toEqual(['B', 'D', 'A', 'C', 'E']);
      expect(replay(['A', 'B', 'C', 'D', 'E'], libraryMove([1, 4], 0))).toEqual(['B', 'E', 'A', 'C', 'D']);
    });

    it('moves one card with one command to the position chosen, as before', () => {
      expect(libraryMove([0], 2)).toEqual([expect.objectContaining({ cardsToMove: { card: [{ cardId: 0 }] }, x: 2 })]);
    });
  });
});

describe('intendedBattlefieldSlots', () => {
  it('collapses one source stack onto the drop slot', () => {
    const cards = [{ id: '1', slot: { row: 1, col: 3 } }, { id: '2', slot: { row: 1, col: 3 } }];
    expect(intendedBattlefieldSlots(cards, { row: 0, col: 0 }, GRID)).toEqual([{ row: 0, col: 0 }, { row: 0, col: 0 }]);
  });

  it('keeps several stacks\' shape, clamped to the grid', () => {
    const cards = [{ id: '1', slot: { row: 0, col: 0 } }, { id: '2', slot: { row: 2, col: 3 } }];
    expect(intendedBattlefieldSlots(cards, { row: 1, col: 6 }, GRID)).toEqual([{ row: 1, col: 6 }, { row: 2, col: 7 }]);
  });

  it('spreads cards without slots row-major, wrapping rows', () => {
    const cards = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(intendedBattlefieldSlots(cards, { row: 0, col: 7 }, GRID)).toEqual([
      { row: 0, col: 7 },
      { row: 1, col: 0 },
      { row: 1, col: 1 },
    ]);
  });
});

describe('seat drop zones', () => {
  const zone = (overrides: Partial<SeatDropZone> = {}): SeatDropZone =>
    ({ kind: 'seat-drop', seatPlayerId: 1, priority: 10, resolve: () => null, ...overrides });

  it('take drops from their own seat; battlefields from every seat', () => {
    expect(seatDropAccepts(zone(), source())).toBe(true);
    expect(seatDropAccepts(zone(), source({ seatPlayerId: 2 }))).toBe(false);
    expect(seatDropAccepts(zone({ acceptsOtherSeats: true }), source({ seatPlayerId: 2 }))).toBe(true);
  });

  it('take a card attached across seats on its owner\'s zones, not the showing seat\'s', () => {
    const foreign = source({ seatPlayerId: 2, zone: 'battlefield', cards: [{ id: '12', ownerPlayerId: 1 }] });
    expect(seatDropAccepts(zone(), foreign)).toBe(true);
    expect(seatDropAccepts(zone({ seatPlayerId: 2 }), foreign)).toBe(false);
  });

  it('are told apart from structured drag data', () => {
    expect(isSeatDragSource(source())).toBe(true);
    expect(isSeatDragSource({ card: {}, sourceZone: 'hand' })).toBe(false);
    expect(isSeatDropZone(zone())).toBe(true);
    expect(isSeatDropZone(undefined)).toBe(false);
  });
});
