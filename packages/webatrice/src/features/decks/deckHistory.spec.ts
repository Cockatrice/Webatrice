import {
  DECK_HISTORY_LIMIT,
  EMPTY_DECK_HISTORY,
  deckHistoryRows,
  recordDeckEdit,
  redoDeck,
  undoDeck,
  type DeckHistory,
} from './deckHistory';
import type { HydratedDeck } from './types';

function deck(name: string): HydratedDeck {
  return { name, meta: { v: 1, updatedAt: 'x' }, cards: [], format: 'modern' };
}

const A = deck('A');
const B = deck('B');
const C = deck('C');

function twoEdits(): DeckHistory {
  let h = recordDeckEdit(EMPTY_DECK_HISTORY, A, { kind: 'rename', from: 'A', to: 'B' }, { now: 0 });
  h = recordDeckEdit(h, B, { kind: 'rename', from: 'B', to: 'C' }, { now: 1000 });
  return h;
}

describe('recordDeckEdit', () => {
  it('saves the deck before the edit and clears redo', () => {
    const undone = undoDeck(twoEdits(), C)!;
    expect(undone.history.redo).toHaveLength(1);

    const h = recordDeckEdit(undone.history, undone.deck, { kind: 'format', format: 'legacy' }, { now: 2000 });
    expect(h.undo.map((m) => m.deck.name)).toEqual(['A', 'B']);
    expect(h.redo).toEqual([]);
  });

  it('merges a typing burst into one entry that keeps the first starting point', () => {
    let h = recordDeckEdit(EMPTY_DECK_HISTORY, A, { kind: 'rename', from: 'A', to: 'Ab' }, { now: 0, coalesceMs: 300 });
    h = recordDeckEdit(h, deck('Ab'), { kind: 'rename', from: 'Ab', to: 'Abc' }, { now: 200, coalesceMs: 300 });
    expect(h.undo).toHaveLength(1);
    expect(h.undo[0].deck).toBe(A);
    expect(h.undo[0].reason).toEqual({ kind: 'rename', from: 'A', to: 'Abc' });
  });

  it('starts a new entry after a pause or a different kind of edit', () => {
    let h = recordDeckEdit(EMPTY_DECK_HISTORY, A, { kind: 'rename', from: 'A', to: 'B' }, { now: 0, coalesceMs: 300 });
    h = recordDeckEdit(h, B, { kind: 'rename', from: 'B', to: 'C' }, { now: 301, coalesceMs: 300 });
    expect(h.undo).toHaveLength(2);
    h = recordDeckEdit(h, C, { kind: 'description', before: 0, after: 3 }, { now: 302, coalesceMs: 400 });
    expect(h.undo).toHaveLength(3);
  });

  it('keeps at most DECK_HISTORY_LIMIT entries, dropping the oldest', () => {
    let h = EMPTY_DECK_HISTORY;
    for (let i = 0; i <= DECK_HISTORY_LIMIT; i++) {
      h = recordDeckEdit(h, deck(String(i)), { kind: 'tags' }, { now: i });
    }
    expect(h.undo).toHaveLength(DECK_HISTORY_LIMIT);
    expect(h.undo[0].deck.name).toBe('1');
  });
});

describe('undoDeck / redoDeck', () => {
  it('undoes in reverse order and redoes back, keeping the reasons with their step', () => {
    const first = undoDeck(twoEdits(), C)!;
    expect(first.deck).toBe(B);
    expect(first.history.redo[0]).toMatchObject({ deck: C, reason: { to: 'C' } });

    const second = undoDeck(first.history, first.deck)!;
    expect(second.deck).toBe(A);
    expect(undoDeck(second.history, second.deck)).toBeNull();

    const redone = redoDeck(second.history, second.deck)!;
    expect(redone.deck).toBe(B);
    expect(redoDeck(redone.history, redone.deck)!.deck).toBe(C);
  });

  it('jumps several steps at once and ignores steps past the end', () => {
    const jumped = undoDeck(twoEdits(), C, 5)!;
    expect(jumped.deck).toBe(A);
    expect(jumped.history.undo).toEqual([]);
    expect(jumped.history.redo).toHaveLength(2);
    expect(redoDeck(jumped.history, jumped.deck, 2)!.deck).toBe(C);
  });

  it('returns null with nothing to redo', () => {
    expect(redoDeck(twoEdits(), C)).toBeNull();
  });
});

describe('deckHistoryRows', () => {
  it('lists redo entries furthest-first, then undo entries newest-first, with jump distances', () => {
    let h = twoEdits();
    h = recordDeckEdit(h, C, { kind: 'tags' }, { now: 2000 });
    const { history } = undoDeck(h, deck('D'), 2)!;

    const rows = deckHistoryRows(history);
    expect(rows.redo.map((r) => [r.reason.kind, r.steps])).toEqual([['tags', 2], ['rename', 1]]);
    expect(rows.undo.map((r) => [r.reason.kind, r.steps])).toEqual([['rename', 1]]);

    expect(redoDeck(history, B, rows.redo[0].steps)!.deck.name).toBe('D');
  });
});
