import { fireEvent, render, screen, within } from '@testing-library/react';

import { EMPTY_DECK_HISTORY, recordDeckEdit, undoDeck, type DeckHistory } from '../../deckHistory';
import type { HydratedDeck } from '../../types';
import { DeckHistoryControls, reasonText } from './DeckHistoryControls';

function deck(name: string): HydratedDeck {
  return { name, meta: { v: 1, updatedAt: 'x' }, cards: [], format: 'modern' };
}

function history(): DeckHistory {
  let h = recordDeckEdit(EMPTY_DECK_HISTORY, deck('A'), { kind: 'format', format: 'legacy' }, { now: 0 });
  h = recordDeckEdit(h, deck('B'), { kind: 'removeCard', name: 'Shock' }, { now: 1 });
  h = recordDeckEdit(h, deck('C'), { kind: 'tags' }, { now: 2 });
  return undoDeck(h, deck('D'))!.history;
}

function renderControls(h: DeckHistory = history()) {
  const props = {
    history: h,
    canUndo: h.undo.length > 0,
    canRedo: h.redo.length > 0,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  };
  render(<DeckHistoryControls {...props} />);
  return props;
}

describe('DeckHistoryControls', () => {
  it('disables undo, redo and the list when there is no history', () => {
    renderControls(EMPTY_DECK_HISTORY);
    expect(screen.getByRole('button', { name: 'DeckHistory.undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'DeckHistory.redo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'DeckHistory.history' })).toBeDisabled();
  });

  it('undoes and redoes one step from the buttons', () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'DeckHistory.undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckHistory.redo' }));
    expect(props.onUndo).toHaveBeenCalledWith();
    expect(props.onRedo).toHaveBeenCalledWith();
  });

  it('lists redo entries above undo entries and jumps to the clicked one', () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'DeckHistory.history' }));

    const list = screen.getByRole('menu', { name: 'DeckHistory.history' });
    const entries = within(list).getAllByRole('menuitem');
    expect(entries.map((e) => e.textContent)).toEqual([
      'DeckHistory.redoEntry',
      'DeckHistory.undoEntry',
      'DeckHistory.undoEntry',
    ]);
    expect(within(list).getByRole('separator')).toBeInTheDocument();

    fireEvent.click(entries[2]);
    expect(props.onUndo).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'DeckHistory.history' }));
    fireEvent.click(within(screen.getByRole('menu')).getAllByRole('menuitem')[0]);
    expect(props.onRedo).toHaveBeenCalledWith(1);
  });
});

describe('reasonText', () => {
  const t = vi.fn((key: string, values?: object) => `${key} ${JSON.stringify(values ?? {})}`);

  it('words quantity changes by direction', () => {
    expect(reasonText({ kind: 'adjustCard', delta: 2, name: 'Bolt' }, t as never))
      .toBe('DeckHistory.reason.added {"count":2,"name":"Bolt"}');
    expect(reasonText({ kind: 'adjustCard', delta: -1, name: 'Bolt' }, t as never))
      .toBe('DeckHistory.reason.removed {"count":1,"name":"Bolt"}');
  });

  it('names zones and passes the remaining fields through', () => {
    expect(reasonText({ kind: 'moveCard', count: 3, name: 'Bolt', zone: 'sideboard' }, t as never))
      .toContain('"zone":"DeckHistory.zone.sideboard {}"');
    expect(reasonText({ kind: 'rename', from: 'A', to: 'B' }, t as never))
      .toBe('DeckHistory.reason.rename {"from":"A","to":"B"}');
  });
});
