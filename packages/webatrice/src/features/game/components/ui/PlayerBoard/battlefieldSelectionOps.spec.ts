import type { SeatSelection } from '../../../hooks/useSeatSelection';
import {
  cardIdsOf,
  cloneSource,
  counterStepEntries,
  currentPT,
  incrementAllCounterEntries,
  ptDeltaEntries,
  resetPTEntries,
  resolveTargets,
  sameSlotIds,
  selectionOrAll,
  totalPower,
} from './battlefieldSelectionOps';
import { MAX_COUNTER_VALUE } from './counterLimits';
import type { BattlefieldCardViewModel } from './playerBoard.types';

const bf = (id: string, extra: Partial<BattlefieldCardViewModel> = {}): BattlefieldCardViewModel => ({
  id,
  name: `Card ${id}`,
  scryfallId: `p${id}`,
  slot: { row: 0, col: Number(id) || 0 },
  subSlot: 0,
  tapped: false,
  ...extra,
});

const A = bf('1', { pt: '3/3', counters: [{ id: 0, value: 2 }] });
const B = bf('2', { faceDown: true, slot: { row: 0, col: 4 } });
const C = bf('3', { pt: '0/4', slot: { row: 2, col: 1 } });
const MOCK = bf('mock-1');
const BOARD = [A, B, C];

const ids = (cards: readonly BattlefieldCardViewModel[] | undefined) => cards?.map((c) => c.id);
const battlefield = (...cardIds: string[]): SeatSelection => ({ zone: 'battlefield', ids: new Set(cardIds) });
const hand = (...cardIds: string[]): SeatSelection => ({ zone: 'hand', ids: new Set(cardIds) });
const printed = (pts: Record<string, string>) => (name: string) => pts[name] ?? '';

describe('resolveTargets', () => {
  it.each([
    ['the clicked card alone, without a selection', null, '3', ['3'], '3'],
    ['the clicked card alone, outside the selection', battlefield('1', '2'), '3', ['3'], '3'],
    ['the whole selection in display order, when the clicked card is in it', battlefield('2', '1'), '2', ['1', '2'], '2'],
    ['the clicked card alone, when the selection is in another zone', hand('3'), '3', ['3'], '3'],
    ['the selection anchored on its first card, from a shortcut', battlefield('3', '2'), undefined, ['2', '3'], '2'],
  ])('targets %s', (_, selection, anchorId, cardIds, anchor) => {
    const targets = resolveTargets(BOARD, selection, anchorId);
    expect({ cards: ids(targets?.cards), anchor: targets?.anchor.id }).toEqual({ cards: cardIds, anchor });
  });

  it.each([
    ['an unknown clicked card', battlefield('1'), '9'],
    ['a shortcut without a battlefield selection', hand('1'), undefined],
    ['a shortcut whose selection left the battlefield', battlefield('9'), undefined],
  ])('is null for %s', (_, selection, anchorId) => {
    expect(resolveTargets(BOARD, selection, anchorId)).toBeNull();
  });
});

describe('selectionOrAll', () => {
  it('is the battlefield selection, or the whole battlefield without one', () => {
    expect(ids(selectionOrAll(BOARD, battlefield('3')))).toEqual(['3']);
    expect(ids(selectionOrAll(BOARD, battlefield()))).toEqual(['1', '2', '3']);
    expect(ids(selectionOrAll(BOARD, null))).toEqual(['1', '2', '3']);
  });
});

describe('per-card entries', () => {
  it('drops cards without a server id', () => {
    expect(cardIdsOf([A, MOCK, C])).toEqual([1, 3]);
    expect(ptDeltaEntries([MOCK], printed({}), 1, 1)).toEqual([]);
  });

  it.each([
    [1, 0, ['4/3', '1/0', '1/4']],
    [-1, 1, ['2/4', '-1/1', '-1/5']],
    [1, 1, ['4/4', '1/1', '1/5']],
  ])('moves each card\'s own P/T by %i/%i, a card without one from 0/0', (deltaP, deltaT, pts) => {
    expect(ptDeltaEntries(BOARD, printed({}), deltaP, deltaT)).toEqual([
      { cardId: 1, pt: pts[0] },
      { cardId: 2, pt: pts[1] },
      { cardId: 3, pt: pts[2] },
    ]);
  });

  it('starts a P/T change from the printed P/T when the server has none', () => {
    expect(currentPT(B, printed({ 'Card 2': '2/2' }))).toBe('2/2');
    expect(currentPT(A, printed({ 'Card 1': '9/9' }))).toBe('3/3');
    expect(ptDeltaEntries([B], printed({ 'Card 2': '2/2' }), 1, 0)).toEqual([{ cardId: 2, pt: '3/2' }]);
  });

  it('resets face-up cards to the printed P/T and face-down cards to none, skipping cards already there', () => {
    const faceDownWithPT = bf('4', { faceDown: true, pt: '2/2' });
    expect(resetPTEntries([A, B, C, faceDownWithPT], printed({ 'Card 1': '2/2', 'Card 3': '0/4' }))).toEqual([
      { cardId: 1, pt: '2/2' },
      { cardId: 4, pt: '' },
    ]);
  });

  it('steps a counter from each card\'s own value, within [0, MAX_COUNTER_VALUE]', () => {
    const capped = bf('5', { counters: [{ id: 0, value: MAX_COUNTER_VALUE }] });
    expect(counterStepEntries([A, B, capped], 0, 1)).toEqual([
      { cardId: 1, counterId: 0, value: 3 },
      { cardId: 2, counterId: 0, value: 1 },
    ]);
    expect(counterStepEntries([A, B, capped], 0, -1)).toEqual([
      { cardId: 1, counterId: 0, value: 1 },
      { cardId: 5, counterId: 0, value: MAX_COUNTER_VALUE - 1 },
    ]);
  });

  it('increments only the counters the cards already carry, below the cap', () => {
    const two = bf('6', { counters: [{ id: 1, value: 0 }, { id: 4, value: MAX_COUNTER_VALUE }] });
    expect(incrementAllCounterEntries([A, B, two])).toEqual([
      { cardId: 1, counterId: 0, value: 3 },
      { cardId: 6, counterId: 1, value: 1 },
    ]);
  });
});

describe('totalPower', () => {
  it.each([
    ['sums the server P/T powers', [A, C], 3],
    ['ignores cards without a server P/T, even with a printed one', [B], 0],
    ['counts a negative power as 0', [bf('7', { pt: '-2/3' }), A], 3],
    ['reads a power-only P/T', [bf('8', { pt: '5' })], 5],
    ['counts a non-numeric power as 0', [bf('9', { pt: '*/*' })], 0],
  ])('%s', (_, cards, total) => {
    expect(totalPower(cards)).toBe(total);
  });
});

describe('cloneSource and sameSlotIds', () => {
  it('copies a card onto its own row', () => {
    expect(cloneSource(bf('3', { pt: '0/4', color: 'w', annotation: 'x', slot: { row: 2, col: 1 } }))).toEqual({
      name: 'Card 3', providerId: 'p3', color: 'w', pt: '0/4', annotation: 'x', y: 2,
    });
    expect(cloneSource(B)).toEqual({ name: 'Card 2', providerId: 'p2', color: '', pt: '', annotation: '', y: 0 });
  });

  it('collects the cards on the anchor\'s row or column', () => {
    const below = bf('4', { slot: { row: 2, col: 4 } });
    expect(sameSlotIds([...BOARD, below], A, 'row')).toEqual(new Set(['1', '2']));
    expect(sameSlotIds([...BOARD, below], B, 'col')).toEqual(new Set(['2', '4']));
  });
});
