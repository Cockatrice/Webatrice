import { useRef, useState } from 'react';
import { act, render, screen } from '@testing-library/react';

import type { DeckListSection } from '../deckSummary';
import type { FlatDeck } from '../deckTree';
import { DECK_LIST_ROW_ATTRIBUTE, useDeckDeleteFocus } from './useDeckDeleteFocus';

const deck = (id: number, name: string) => ({ id, name }) as FlatDeck;

let confirm: (deck: FlatDeck) => void;
let removeDeck: (id: number) => void;

function DeckList({ initial }: { initial: DeckListSection[] }) {
  const [sections, setSections] = useState(initial);
  const fallbackRef = useRef<HTMLDivElement>(null);
  confirm = useDeckDeleteFocus(sections, fallbackRef);
  removeDeck = (id) => setSections((prev) => prev
    .map(({ section, decks }) => ({ section, decks: decks.filter((d) => d.id !== id) }))
    .filter(({ decks }) => decks.length > 0));
  return (
    <div ref={fallbackRef} data-testid="list">
      <button type="button">Elsewhere</button>
      {sections.map(({ section, decks }) => (
        <ul key={section}>
          {decks.map((d) => (
            <li key={d.id} {...{ [DECK_LIST_ROW_ATTRIBUTE]: d.id }}>
              <button type="button">{`Open ${d.name}`}</button>
              <button type="button">{`Delete ${d.name}`}</button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

const sections: DeckListSection[] = [
  { section: 'modern', decks: [deck(1, 'Burn'), deck(2, 'Tron')] },
  { section: 'legacy', decks: [deck(3, 'Storm')] },
];

function deleteFromRow(target: FlatDeck) {
  screen.getByRole('button', { name: `Delete ${target.name}` }).focus();
  confirm(target);
  act(() => removeDeck(target.id));
}

describe('useDeckDeleteFocus', () => {
  it('moves focus to the next deck once the deleted one leaves the list, across sections', () => {
    render(<DeckList initial={sections} />);
    deleteFromRow(deck(2, 'Tron'));
    expect(screen.getByRole('button', { name: 'Open Storm' })).toHaveFocus();
  });

  it('falls back to the previous deck, then to the list', () => {
    render(<DeckList initial={sections} />);
    deleteFromRow(deck(3, 'Storm'));
    expect(screen.getByRole('button', { name: 'Open Tron' })).toHaveFocus();

    deleteFromRow(deck(2, 'Tron'));
    deleteFromRow(deck(1, 'Burn'));
    expect(screen.getByTestId('list')).toHaveFocus();
  });

  it('waits for the server and leaves focus the user moved meanwhile', () => {
    render(<DeckList initial={sections} />);
    screen.getByRole('button', { name: 'Delete Burn' }).focus();
    confirm(deck(1, 'Burn'));
    screen.getByRole('button', { name: 'Elsewhere' }).focus();
    act(() => removeDeck(1));
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });
});
