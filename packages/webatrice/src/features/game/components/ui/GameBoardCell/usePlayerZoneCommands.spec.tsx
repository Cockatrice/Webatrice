import { act } from '@testing-library/react';
import { ZoneName } from '@cockatrice/sockatrice';
import { makeCard, makeZoneEntry } from '@cockatrice/datatrice/testing';
import { renderSeatHook, type SeatGameSpec } from '../../../__test-utils__/seatFixtures';
import { resolveBattlefieldDropX } from './useMoveCard';
import { usePlayerZoneCommands } from './usePlayerZoneCommands';

const SHOCK = makeCard({ id: 30, name: 'Shock' });
const BOLT = makeCard({ id: 31, name: 'Bolt' });
const TOKEN = makeCard({ id: 60, name: 'Goblin', x: 0, y: 0, destroyOnZoneChange: true });
const OGRE = makeCard({ id: 61, name: 'Ogre', x: 0, y: 0, tapped: true, pt: '4/4', annotation: 'note', counterList: [] });

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, hand: [SHOCK, BOLT], table: [TOKEN, OGRE], deckCount: 40 },
    { playerId: 2, handCount: 7 },
  ],
};

function renderZone() {
  const utils = renderSeatHook(() => usePlayerZoneCommands(1), SPEC);
  const zone = (playerId: number, name: string) => utils.store.getState().games.games[1].players[playerId].zones[name];
  return { ...utils, zone, commands: () => utils.result()! };
}

const move = (overrides: Record<string, unknown>) => ({
  startPlayerId: 1,
  startZone: ZoneName.HAND,
  cardsToMove: { card: [{ cardId: 30 }] },
  targetPlayerId: 1,
  targetZone: ZoneName.GRAVE,
  x: 0,
  y: 0,
  ...overrides,
});

describe('resolveBattlefieldDropX', () => {
  const table = (cards: ReadonlyArray<readonly [id: number, x: number, y: number]>) =>
    makeZoneEntry({
      name: ZoneName.TABLE,
      order: cards.map(([id]) => id),
      byId: Object.fromEntries(cards.map(([id, x, y]) => [id, makeCard({ id, x, y })])),
    });

  it.each([
    ['an empty column', [], 6, 6],
    ['the next free sub-slot', [[1, 6, 0]], 6, 7],
    ['a sub-slot gap', [[1, 6, 0], [2, 8, 0]], 6, 7],
    ['the right neighbour when full', [[1, 6, 0], [2, 7, 0], [3, 8, 0]], 6, 9],
    ['the left neighbour when the right is full too', [[1, 6, 0], [2, 7, 0], [3, 8, 0], [4, 9, 0], [5, 10, 0], [6, 11, 0]], 6, 3],
    ['cards on other rows', [[1, 6, 1], [2, 7, 2]], 6, 6],
  ] as const)('lands in %s', (_label, cards, x, expected) => {
    expect(resolveBattlefieldDropX(move({ targetZone: ZoneName.TABLE, x }) as never, table(cards))).toBe(expected);
  });

  it('passes a negative x through for the server to place', () => {
    const full = table([[1, 0, 0], [2, 1, 0], [3, 2, 0]]);
    expect(resolveBattlefieldDropX(move({ targetZone: ZoneName.TABLE, x: -1 }) as never, full)).toBe(-1);
    expect(resolveBattlefieldDropX(move({ targetZone: ZoneName.TABLE, x: -2 }) as never, full)).toBe(-2);
  });

  it('ignores the moving card\'s own slot only for a same-table move', () => {
    const board = table([[61, 0, 0]]);
    const reslot = move({ startZone: ZoneName.TABLE, targetZone: ZoneName.TABLE, cardsToMove: { card: [{ cardId: 61 }] } });
    expect(resolveBattlefieldDropX(reslot as never, board)).toBe(0);
    expect(resolveBattlefieldDropX({ ...reslot, startPlayerId: 2 } as never, board)).toBe(1);
  });
});

describe('usePlayerZoneCommands — move', () => {
  it('reorders a positional zone optimistically and restores the index on rejection', () => {
    const { commands, zone, game } = renderZone();
    act(() => commands().move(move({ targetZone: ZoneName.HAND, x: 1 })));
    expect(zone(1, ZoneName.HAND).order).toEqual([31, 30]);

    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    act(() => vi.mocked(game.moveCard).mock.calls[0][3]!.onError!(1, {} as never));
    expect(zone(1, ZoneName.HAND).order).toEqual([30, 31]);
  });

  it('resets battlefield state on the optimistic copy of a card leaving the table', () => {
    const { commands, zone } = renderZone();
    act(() => commands().move(move({ startZone: ZoneName.TABLE, cardsToMove: { card: [{ cardId: 61 }] } })));
    expect(zone(1, ZoneName.GRAVE).byId[61]).toMatchObject({ tapped: false, pt: '', annotation: '', counterList: [] });
  });

  it('keeps the annotation when the card leaves the table for the stack', () => {
    const { commands, zone } = renderZone();
    act(() => commands().move(move({ startZone: ZoneName.TABLE, targetZone: ZoneName.STACK, cardsToMove: { card: [{ cardId: 61 }] } })));
    expect(zone(1, ZoneName.STACK).byId[61].annotation).toBe('note');
  });

  it('waits for the server for tokens leaving the table, batches and unknown cards', () => {
    const { commands, zone, game } = renderZone();
    const token = move({ startZone: ZoneName.TABLE, cardsToMove: { card: [{ cardId: 60 }] } });
    const batch = move({ cardsToMove: { card: [{ cardId: 30 }, { cardId: 31 }] } });
    const unknown = move({ cardsToMove: { card: [{ cardId: 99 }] } });
    act(() => {
      commands().move(token);
      commands().move(batch);
      commands().move(unknown);
    });
    expect(vi.mocked(game.moveCard).mock.calls).toEqual([[1, token], [1, batch], [1, unknown]]);
    expect(zone(1, ZoneName.TABLE).order).toContain(60);
    expect(zone(1, ZoneName.HAND).order).toEqual([30, 31]);
  });
});

describe('usePlayerZoneCommands — moveCards', () => {
  it('builds one Command_MoveCard between two of the seat zones', () => {
    const { commands, game } = renderZone();
    act(() => {
      commands().moveCards(ZoneName.DECK, [1, { id: 0, faceDown: true }], { zone: ZoneName.GRAVE });
      commands().moveCards(ZoneName.DECK, [0], { zone: ZoneName.TABLE, index: 'end', row: 2 });
      commands().moveCards(ZoneName.TABLE, [61], { zone: ZoneName.DECK, reversed: true });
    });

    expect(vi.mocked(game.moveCard).mock.calls.map(([, p]) => p)).toEqual([
      {
        startPlayerId: 1,
        startZone: ZoneName.DECK,
        cardsToMove: { card: [{ cardId: 1 }, { cardId: 0, faceDown: true }] },
        targetPlayerId: 1,
        targetZone: ZoneName.GRAVE,
        x: 0,
        y: 0,
      },
      expect.objectContaining({ targetZone: ZoneName.TABLE, x: -1, y: 2 }),
      expect.objectContaining({ startZone: ZoneName.TABLE, targetZone: ZoneName.DECK, x: 0, y: 0, isReversed: true }),
    ]);
  });

  it('sends the P/T and tapped state a played card lands with', () => {
    const { commands, game } = renderZone();
    act(() => {
      commands().moveCards(ZoneName.HAND, [{ id: 7, pt: '2/2', tapped: true }], { zone: ZoneName.TABLE, index: 'end', row: 1 });
    });

    expect(vi.mocked(game.moveCard).mock.calls[0][1].cardsToMove).toEqual({
      card: [{ cardId: 7, pt: '2/2', tapped: true }],
    });
  });

  it('shuffles a block of cards moved to the top or bottom of the library with the move', () => {
    const { commands, game } = renderZone();
    act(() => {
      commands().moveCards(ZoneName.HAND, [30, 31], { zone: ZoneName.DECK, reversed: false, shuffleMoved: true });
      commands().moveCards(ZoneName.TABLE, [61, 62, 63], { zone: ZoneName.DECK, reversed: true, shuffleMoved: true });
      commands().moveCards(ZoneName.HAND, [32], { zone: ZoneName.DECK, reversed: false, shuffleMoved: true });
    });

    expect(vi.mocked(game.moveCardAndShuffle).mock.calls.map(([, move, shuffle]) => [move, shuffle])).toEqual([
      [
        expect.objectContaining({ startZone: ZoneName.HAND, cardsToMove: { card: [{ cardId: 30 }, { cardId: 31 }] }, x: 0 }),
        { zoneName: ZoneName.DECK, start: 0, end: 1 },
      ],
      [
        expect.objectContaining({ startZone: ZoneName.TABLE, isReversed: true }),
        { zoneName: ZoneName.DECK, start: -3, end: -1 },
      ],
    ]);
    expect(vi.mocked(game.moveCard).mock.calls.map(([, p]) => p.cardsToMove)).toEqual([{ card: [{ cardId: 32 }] }]);
  });

  it('sends is_reversed only when the caller gives it', () => {
    const { commands, game } = renderZone();
    act(() => commands().moveCards(ZoneName.HAND, [30, 31], { zone: ZoneName.DECK, index: 'end' }));
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).not.toHaveProperty('isReversed');
    expect(vi.mocked(game.moveCard).mock.calls[0][1]).toMatchObject({ x: -1 });
  });
});

describe('usePlayerZoneCommands — gifts', () => {
  it('resolves a gift onto another player table against that board', () => {
    const giftSpec: SeatGameSpec = {
      ...SPEC,
      seats: [SPEC.seats[0], { playerId: 2, handCount: 7, table: [makeCard({ id: 20, name: 'Bear', x: 0, y: 0 })] }],
    };
    const utils = renderSeatHook(() => usePlayerZoneCommands(1), giftSpec);
    act(() => utils.result()!.move(move({
      startZone: ZoneName.DECK,
      cardsToMove: { card: [{ cardId: 0 }] },
      targetPlayerId: 2,
      targetZone: ZoneName.TABLE,
    })));
    expect(vi.mocked(utils.game.moveCard).mock.calls[0][1]).toMatchObject({ targetPlayerId: 2, x: 1, y: 0 });
  });
});

describe('usePlayerZoneCommands — library and reveals', () => {
  it('maps recipients and selections onto the reveal sentinels', () => {
    const { commands, game } = renderZone();
    commands().reveal(ZoneName.HAND, 'all');
    commands().reveal(ZoneName.GRAVE, 2, 'random');
    commands().reveal(ZoneName.DECK, 'all', { top: 3 });
    commands().reveal(ZoneName.DECK, 2, 'zone');
    commands().reveal(ZoneName.HAND, 'all', { cardIds: [4, 9] });
    commands().reveal(ZoneName.SIDEBOARD, 2, { cardIds: [7] });
    commands().lendLibrary(2);

    expect(vi.mocked(game.revealCards).mock.calls.map(([, p]) => p)).toEqual([
      { zoneName: ZoneName.HAND },
      { zoneName: ZoneName.GRAVE, cardId: [-2], playerId: 2 },
      { zoneName: ZoneName.DECK, topCards: 3, cardId: [0] },
      { zoneName: ZoneName.DECK, playerId: 2 },
      { zoneName: ZoneName.HAND, cardId: [4, 9] },
      { zoneName: ZoneName.SIDEBOARD, cardId: [7], playerId: 2 },
      { zoneName: ZoneName.DECK, playerId: 2, grantWriteAccess: true },
    ]);
  });

  it('shuffles the whole library by default and an inclusive range on request', () => {
    const { commands, game } = renderZone();
    commands().shuffleLibrary();
    commands().shuffleLibrary({ start: -3, end: -1 });
    expect(vi.mocked(game.shuffle).mock.calls.map(([, p]) => p)).toEqual([
      { zoneName: ZoneName.DECK, start: 0, end: -1 },
      { zoneName: ZoneName.DECK, start: -3, end: -1 },
    ]);
  });
});
