import { fireEvent, render, screen, within } from '@testing-library/react';

import { SAMPLE_HAND_SIZE_STORAGE_KEY } from '../../hooks/useSampleHand';
import type { DeckCard } from '../../types';
import { SampleHandPanel } from './SampleHandPanel';

const card = (name: string, quantity: number, overrides: Partial<DeckCard> = {}): DeckCard => ({
  name, quantity, cmc: 1, category: 'main', lookupSource: 'scryfall', ...overrides,
});

const deck = [
  card('Bolt', 4, { imageUri: 'https://img/bolt.jpg' }),
  card('Forest', 10),
  card('Elves', 4, { category: 'sideboard' }),
];

function open(cards: DeckCard[] = deck, random?: () => number) {
  render(<SampleHandPanel cards={cards} showImages random={random} />);
  fireEvent.click(screen.getByRole('button', { name: 'SampleHand.title' }));
}

function handNames(): string[] {
  const list = screen.getByRole('list', { name: 'SampleHand.title' });
  return within(list).getAllByRole('listitem').map((li) => li.textContent || li.querySelector('img')!.alt);
}

beforeEach(() => {
  window.localStorage.removeItem(SAMPLE_HAND_SIZE_STORAGE_KEY);
});

describe('SampleHandPanel', () => {
  it('reserves the final card size before loading and after failure', () => {
    open([card('Bolt', 1, { imageUri: 'https://img/bolt.jpg' })]);
    const image = screen.getByAltText('Bolt');
    expect(image).toHaveStyle({ opacity: '0' });
    expect(screen.queryByText('Bolt')).toBeNull();
    const frame = image.closest('.aspect-\\[5\\/7\\]');
    expect(frame).not.toBeNull();
    fireEvent.load(image);
    expect(image).toHaveStyle({ opacity: '1' });
    fireEvent.error(image);
    expect(frame).toHaveTextContent('Bolt');
    expect(screen.queryByAltText('Bolt')).toBeNull();
  });

  it('is collapsed until opened, then shows a 7-card hand from the main deck', () => {
    render(<SampleHandPanel cards={deck} showImages />);
    expect(screen.queryByRole('list')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'SampleHand.title' }));

    const names = handNames();
    expect(names).toHaveLength(7);
    expect(names).not.toContain('Elves');
    expect(names.every((n) => n === 'Bolt' || n === 'Forest')).toBe(true);
  });

  it('redraws a new hand without touching the deck', () => {
    const distinct = ['A', 'B', 'C', 'D', 'E'].map((name) => card(name, 1));
    let roll = 0;
    open(distinct, () => roll);
    expect(handNames()).toEqual(['B', 'C', 'D', 'E', 'A']);

    roll = 0.99;
    fireEvent.click(screen.getByRole('button', { name: 'SampleHand.redraw' }));
    expect(handNames()).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(distinct.map((c) => c.quantity)).toEqual([1, 1, 1, 1, 1]);
  });

  it('draws the chosen number of cards and remembers it', () => {
    open();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'SampleHand.size' }), { target: { value: '3' } });
    expect(handNames()).toHaveLength(3);
    expect(window.localStorage.getItem(SAMPLE_HAND_SIZE_STORAGE_KEY)).toBe('3');

    fireEvent.change(screen.getByRole('spinbutton', { name: 'SampleHand.size' }), { target: { value: '0' } });
    expect(screen.getByRole('spinbutton', { name: 'SampleHand.size' })).toHaveValue(1);
  });

  it('draws what there is from a small deck', () => {
    open([card('Bolt', 2)]);
    expect(handNames()).toEqual(['Bolt', 'Bolt']);
  });

  it('explains when the main deck is empty', () => {
    open([card('Elves', 4, { category: 'sideboard' })]);
    expect(screen.getByText('SampleHand.empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SampleHand.redraw' })).toBeDisabled();
  });

  it('tries the next catalogue image after an image error', () => {
    open([card('Bolt', 1, {
      imageUri: 'https://img/first.jpg',
      imageUris: ['https://img/first.jpg', 'https://img/second.jpg'],
    })]);

    const image = screen.getByRole('img', { name: 'Bolt' });
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', 'https://img/second.jpg');
  });
});
