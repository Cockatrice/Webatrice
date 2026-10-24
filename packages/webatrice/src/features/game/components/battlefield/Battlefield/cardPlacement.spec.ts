import {
  tableRowFromTypeLine,
  parseTableRow,
  placementForCard,
  playedCardFields,
  tableRowToGridY,
} from './cardPlacement';
import { applyInvertY } from './gridMath';

describe('cardPlacement', () => {
  it.each([
    ['0', 0],
    ['3', 3],
    ['12', 12],
    ['', null],
    [' 1', null],
    ['-1', null],
    ['x', null],
    [undefined, null],
    [null, null],
  ])('parses tablerow %j as %j', (raw, expected) => {
    expect(parseTableRow(raw)).toBe(expected);
  });

  it.each([
    [0, 2],
    [1, 1],
    [2, 0],
    [3, 1],
    [7, 1],
    [-1, 2],
  ])('tableRowToGridY(%i) = %i', (row, y) => {
    expect(tableRowToGridY(row)).toBe(y);
  });

  describe('card-database policy (playCardViaTableRow)', () => {
    it.each([
      [0, { zone: 'table', visualY: 2 }],
      [1, { zone: 'table', visualY: 1 }],
      [2, { zone: 'table', visualY: 0 }],
      [3, { zone: 'stack' }],
      [4, { zone: 'table', visualY: 1 }],
      [null, { zone: 'table', visualY: 1 }],
    ] as const)('row %j plays to %j', (row, placement) => {
      expect(placementForCard({ tableRow: row })).toEqual(placement);
    });

    it('face-down plays use the creature row regardless of the database', () => {
      expect(placementForCard({ tableRow: 3 }, true)).toEqual({ zone: 'table', visualY: 0 });
    });
  });

  describe('Oracle maintype fallback', () => {
    it.each([
      ['Basic Land — Forest', 0],
      ['Artifact', 1],
      ['Enchantment — Aura', 1],
      ['Legendary Planeswalker — Jace', 1],
      ['Creature — Bear', 2],
      ['Artifact Creature — Golem', 2],
      ['Land Creature — Forest Dryad', 2],
      ['Instant', 3],
      ['Sorcery — Adventure', 3],
      ['', 1],
    ] as const)('%j is row %i', (typeLine, row) => {
      expect(tableRowFromTypeLine(typeLine)).toBe(row);
    });
  });

  it('leaves y-inversion to the caller, which applies it exactly once', () => {
    const placement = placementForCard({ tableRow: 0 });
    if (placement.zone !== 'table') {
      throw new Error('expected a table placement');
    }
    expect(applyInvertY(placement.visualY, false)).toBe(2);
    expect(applyInvertY(placement.visualY, true)).toBe(0);
    expect(applyInvertY(applyInvertY(placement.visualY, true), true)).toBe(placement.visualY);
  });

  it.each([
    ['the printed P/T, tapped for cipt', { pt: '2/2', cipt: true }, false, { pt: '2/2', tapped: true }],
    ['the printed P/T alone', { pt: '0/4' }, false, { pt: '0/4' }],
    ['tapped alone for a cipt card without P/T', { cipt: true }, false, { tapped: true }],
    ['nothing face down', { pt: '2/2', cipt: true }, true, {}],
    ['nothing without metadata', undefined, false, {}],
  ])('a played card carries %s', (_, meta, faceDown, fields) => {
    expect(playedCardFields(meta, faceDown)).toEqual(fields);
  });
});
