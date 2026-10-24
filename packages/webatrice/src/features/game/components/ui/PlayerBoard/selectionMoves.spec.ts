import { ZoneName } from '@cockatrice/sockatrice';

import { moveSelectedCards, tableMove } from './selectionMoves';

const META = new Map([
  ['Forest', { typeLine: 'Basic Land — Forest', cipt: true }],
  ['Ogre', { typeLine: 'Creature — Ogre', pt: '3/3' }],
  ['Shock', { typeLine: 'Instant' }],
  ['Sol Ring', { typeLine: 'Artifact' }],
  ['Dryad Arbor', { typeLine: 'Land Creature — Forest Dryad', pt: '1/1', tableRow: 0 }],
]);
const meta = (name: string) => META.get(name);
const card = (id: string, name: string) => ({ id, name });

describe('tableMove', () => {
  it('puts the card in its row, with its P/T and cipt', () => {
    expect(tableMove(1, meta('Ogre'))).toEqual({ card: { id: 1, pt: '3/3' }, to: { zone: ZoneName.TABLE, index: 'end', row: 0 } });
    expect(tableMove(2, meta('Forest'))).toEqual({ card: { id: 2, tapped: true }, to: { zone: ZoneName.TABLE, index: 'end', row: 2 } });
    expect(tableMove(3, meta('Sol Ring'))).toEqual({ card: 3, to: { zone: ZoneName.TABLE, index: 'end', row: 1 } });
    expect(tableMove(4, meta('Shock'))).toEqual({ card: 4, to: { zone: ZoneName.TABLE, index: 'end', row: 1 } });
    expect(tableMove(5, undefined)).toEqual({ card: 5, to: { zone: ZoneName.TABLE, index: 'end', row: 1 } });
  });

  it('takes the row from cards.xml tablerow over the type line', () => {
    expect(tableMove(6, meta('Dryad Arbor'))).toEqual({ card: { id: 6, pt: '1/1' }, to: { zone: ZoneName.TABLE, index: 'end', row: 2 } });
  });
});

describe('moveSelectedCards', () => {
  it('sends one command per card onto the battlefield from another zone', () => {
    const moveCards = vi.fn();
    moveSelectedCards(moveCards, ZoneName.GRAVE, [card('7', 'Ogre'), card('8', 'Forest')], { zone: ZoneName.TABLE }, meta);
    expect(moveCards.mock.calls).toEqual([
      [ZoneName.GRAVE, [{ id: 7, pt: '3/3' }], { zone: ZoneName.TABLE, index: 'end', row: 0 }],
      [ZoneName.GRAVE, [{ id: 8, tapped: true }], { zone: ZoneName.TABLE, index: 'end', row: 2 }],
    ]);
  });

  it('marks a block of more than one card into the library for the shuffle', () => {
    const moveCards = vi.fn();
    const two = [card('7', 'Ogre'), card('8', 'Forest')];
    moveSelectedCards(moveCards, ZoneName.TABLE, two, { zone: ZoneName.DECK }, meta);
    moveSelectedCards(moveCards, ZoneName.TABLE, two, { zone: ZoneName.DECK, reversed: true }, meta);
    moveSelectedCards(moveCards, ZoneName.TABLE, [two[0]], { zone: ZoneName.DECK }, meta);
    moveSelectedCards(moveCards, ZoneName.TABLE, two, { zone: ZoneName.EXILE }, meta);
    expect(moveCards.mock.calls).toEqual([
      [ZoneName.TABLE, [7, 8], { zone: ZoneName.DECK, reversed: false, shuffleMoved: true }],
      [ZoneName.TABLE, [7, 8], { zone: ZoneName.DECK, reversed: true, shuffleMoved: true }],
      [ZoneName.TABLE, [7], { zone: ZoneName.DECK, reversed: false }],
      [ZoneName.TABLE, [7, 8], { zone: ZoneName.EXILE, reversed: false }],
    ]);
  });

  it('skips cards without a server id, and sends nothing for none', () => {
    const moveCards = vi.fn();
    moveSelectedCards(moveCards, ZoneName.HAND, [card('tmp-1', 'Ogre')], { zone: ZoneName.GRAVE }, meta);
    expect(moveCards).not.toHaveBeenCalled();
    moveSelectedCards(moveCards, ZoneName.HAND, [card('tmp-1', 'Ogre'), card('9', 'Shock')], { zone: ZoneName.GRAVE }, meta);
    expect(moveCards).toHaveBeenCalledExactlyOnceWith(ZoneName.HAND, [9], { zone: ZoneName.GRAVE, reversed: false });
  });
});
