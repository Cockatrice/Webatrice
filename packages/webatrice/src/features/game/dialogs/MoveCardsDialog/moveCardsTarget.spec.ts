import { ZoneName } from '@cockatrice/sockatrice';

import { planSeatMove, type SeatDragSource, type SeatDropTarget } from '../../hooks/seatDropPlan';
import { battlefieldRows, moveDestinations, moveTarget, positionCount, type MoveBoard } from './moveCardsTarget';

const PLAYERS = [{ playerId: 2, name: 'Bob' }, { playerId: 1, name: 'Alice' }];

const source = (zone: SeatDragSource['zone'], cards: SeatDragSource['cards'], extra: Partial<SeatDragSource> = {}): SeatDragSource =>
  ({ kind: 'seat', seatPlayerId: 1, zone, cards, ...extra });
const ids = (...list: string[]) => list.map((id) => ({ id }));

const GRID = { rows: 3, cols: 6, colsByWireRow: [6, 6, 5] };
const BOARD: MoveBoard = {
  players: PLAYERS,
  handOrder: ['5', '6', '7', '8'],
  stackSize: 2,
  deckSize: 30,
  geometry: () => GRID,
};

const pointerDrop = (playerId: number, row: number, col: number): SeatDropTarget =>
  ({ zone: 'battlefield', playerId, slot: { row, col }, grid: { rows: GRID.rows, cols: GRID.cols } });

const labels = (s: SeatDragSource) =>
  moveDestinations(s, PLAYERS).map((d) => (d.zone === 'battlefield' ? `battlefield:${d.playerId}` : d.zone));

describe('moveDestinations', () => {
  it('offers every player\'s battlefield, the owner\'s first, then the owner\'s zones', () => {
    expect(labels(source('hand', ids('5')))).toEqual(
      ['battlefield:1', 'battlefield:2', 'hand', 'stack', 'library', 'graveyard', 'exile'],
    );
  });

  it('leaves out the zone the cards are in unless it has positions', () => {
    expect(labels(source('graveyard', ids('5')))).not.toContain('graveyard');
    expect(labels(source('stack', ids('5')))).not.toContain('stack');
    expect(labels(source('library', ids('0')))).toContain('library');
  });

  it('offers a lent card only the borrower\'s battlefield, every battlefield to a judge', () => {
    const lent = source('library', ids('3'), { lenderPlayerId: 2 });
    expect(labels(lent)).toEqual(['battlefield:1']);
    expect(moveDestinations(lent, PLAYERS, { judge: true }).map((d) => d.zone === 'battlefield' && d.playerId))
      .toEqual([1, 2]);
  });
});

describe('positionCount', () => {
  it('counts the gaps among the cards that stay, as a drop counts them', () => {
    expect(positionCount({ zone: 'hand' }, source('battlefield', ids('5')), BOARD, 0)).toBe(5);
    expect(positionCount({ zone: 'hand' }, source('hand', ids('5', '6')), BOARD, 0)).toBe(3);
    expect(positionCount({ zone: 'library' }, source('hand', ids('5')), BOARD, 0)).toBe(31);
    expect(positionCount({ zone: 'graveyard' }, source('hand', ids('5')), BOARD, 0)).toBe(0);
  });

  it('offers the columns a drop can reach on the board, an empty row\'s reserved ones too', () => {
    expect(positionCount({ zone: 'battlefield', playerId: 2 }, source('hand', ids('5')), BOARD, 1)).toBe(6);
    expect(positionCount({ zone: 'battlefield', playerId: 2 }, source('hand', ids('5')), BOARD, 2)).toBe(5);
  });
});

describe('battlefieldRows', () => {
  it('names the rows by what desktop plays there, inverted with the board', () => {
    expect(battlefieldRows(false)).toEqual([
      { kind: 'lands', row: 2 }, { kind: 'creatures', row: 1 }, { kind: 'other', row: 0 },
    ]);
    expect(battlefieldRows(true).map((r) => r.row)).toEqual([0, 1, 2]);
  });
});

describe('a keyboard move sends what the pointer drop sends', () => {
  const same = (s: SeatDragSource, keyboard: SeatDropTarget, pointer: SeatDropTarget) => {
    expect(keyboard).toEqual(pointer);
    expect(planSeatMove(s, keyboard)).toEqual(planSeatMove(s, pointer));
    return planSeatMove(s, keyboard);
  };

  it('keeps a selection with gaps apart, on the grid the board uses', () => {
    const s = source('battlefield', [{ id: '10', slot: { row: 0, col: 0 } }, { id: '11', slot: { row: 0, col: 4 } }]);
    const plan = same(s, moveTarget({ zone: 'battlefield', playerId: 1 }, BOARD, { position: 1, row: 1 }), pointerDrop(1, 1, 0));
    expect(plan.map((p) => [p.x, p.y])).toEqual([[0, 1], [12, 1]]);
  });

  it('reaches an empty row\'s reserved columns', () => {
    const s = source('hand', ids('5'));
    const plan = same(s, moveTarget({ zone: 'battlefield', playerId: 2 }, BOARD, { position: 4, row: 2 }), pointerDrop(2, 2, 3));
    expect(plan).toEqual([expect.objectContaining({ targetPlayerId: 2, targetZone: ZoneName.TABLE, x: 9, y: 2 })]);
  });

  it('reorders the hand by the order the strip shows, one card at a time', () => {
    const s = source('hand', ids('5', '6'));
    const pointer: SeatDropTarget = { zone: 'hand', index: 2, order: BOARD.handOrder };
    const plan = same(s, moveTarget({ zone: 'hand' }, BOARD, { position: 3, row: 0 }), pointer);
    expect(plan.map((p) => [p.cardsToMove!.card![0].cardId, p.x])).toEqual([[5, 3], [6, 3]]);
  });

  it('inserts into the stack at a 0-based index, and the library from the top', () => {
    const s = source('battlefield', ids('5'));
    expect(planSeatMove(s, moveTarget({ zone: 'stack' }, BOARD, { position: 2, row: 0 }))[0])
      .toEqual(expect.objectContaining({ targetZone: ZoneName.STACK, x: 1 }));
    expect(planSeatMove(s, moveTarget({ zone: 'library' }, BOARD, { position: 4, row: 0 }))[0])
      .toEqual(expect.objectContaining({ targetZone: ZoneName.DECK, x: 3 }));
  });

  it('moves a lent card out of the lender\'s library onto the borrower\'s battlefield', () => {
    const s = source('library', ids('3'), { lenderPlayerId: 2 });
    expect(planSeatMove(s, moveTarget({ zone: 'battlefield', playerId: 1 }, BOARD, { position: 1, row: 2 }))).toEqual([
      expect.objectContaining({ startPlayerId: 2, startZone: ZoneName.DECK, targetPlayerId: 1, targetZone: ZoneName.TABLE, x: 0, y: 2 }),
    ]);
  });
});
