import { DEFAULT_SAMPLE_HAND_SIZE, clampHandSize, drawSampleHand, sampleLibrary } from './sampleHand';
import type { DeckCard } from './types';

const card = (name: string, quantity: number, cmc: number, overrides: Partial<DeckCard> = {}): DeckCard => ({
  name, quantity, cmc, category: 'main', lookupSource: 'scryfall', ...overrides,
});

const first = () => 0;

describe('sampleLibrary', () => {
  it('has one entry per main-deck copy, leaving out the sideboard and the commander', () => {
    const library = sampleLibrary([
      card('Bolt', 2, 1),
      card('Elves', 3, 1, { category: 'sideboard' }),
      card('Atraxa', 1, 7, { isCommander: true }),
      card('Forest', 1, 0),
    ]);
    expect(library.map((c) => c.name)).toEqual(['Bolt', 'Bolt', 'Forest']);
  });
});

describe('drawSampleHand', () => {
  const library = sampleLibrary([card('A', 1, 3), card('B', 1, 1), card('C', 1, 10), card('D', 1, 2), card('E', 1, 0)]);

  it('draws N cards with the injected randomness, sorted numerically by mana value', () => {
    expect(drawSampleHand(library, 3, first).map((c) => c.name)).toEqual(['B', 'D', 'C']);
  });

  it('draws different hands for different randomness without changing the library', () => {
    const before = library.map((c) => c.name);
    const a = drawSampleHand(library, 2, first).map((c) => c.name);
    const b = drawSampleHand(library, 2, () => 0.99).map((c) => c.name);
    expect(a).not.toEqual(b);
    expect(library.map((c) => c.name)).toEqual(before);
  });

  it('draws the whole library when it is smaller than the hand, and nothing from an empty one', () => {
    expect(drawSampleHand(library, 99, first)).toHaveLength(5);
    expect(drawSampleHand([], 7, first)).toEqual([]);
  });
});

describe('clampHandSize', () => {
  it('keeps the size at least 1 and whole', () => {
    expect(clampHandSize(0)).toBe(1);
    expect(clampHandSize(8.7)).toBe(8);
    expect(clampHandSize(Number.NaN)).toBe(DEFAULT_SAMPLE_HAND_SIZE);
  });
});
