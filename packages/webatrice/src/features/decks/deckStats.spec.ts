import { colorPieSlices, computeDeckStats, sortedTypeCounts } from './deckStats';
import type { DeckCard } from './types';

function card(name: string, overrides: Partial<DeckCard>): DeckCard {
  return { name, quantity: 1, category: 'main', lookupSource: 'scryfall', ...overrides };
}

describe('computeDeckStats', () => {
  const stats = computeDeckStats([
    card('Forest', { typeLine: 'Basic Land — Forest', quantity: 10 }),
    card('Sol Ring', { typeLine: 'Artifact', cmc: 1, colors: [] }),
    card('Bolt', { typeLine: 'Instant', cmc: 1, colors: ['R'], quantity: 2 }),
    card('Atraxa', { typeLine: 'Legendary Creature', cmc: 7, colors: ['W', 'U', 'B', 'G'] }),
    card('Emrakul', { typeLine: 'Creature', cmc: 15, colors: [] }),
  ]);

  it('totals lands and nonlands by quantity', () => {
    expect(stats.totalCards).toBe(15);
    expect(stats.landCount).toBe(10);
    expect(stats.nonlandCards).toBe(5);
    expect(stats.avgNonlandCmc).toBeCloseTo((1 + 2 + 7 + 15) / 5);
  });

  it('buckets the curve with a 7+ ceiling, excluding lands', () => {
    expect(stats.curve).toEqual({ 1: 3, 7: 2 });
  });

  it('counts colour identity per card, colorless when it has none', () => {
    expect(stats.pips).toEqual({ W: 1, U: 1, B: 1, R: 2, G: 1, C: 2 });
  });

  it('counts primary card types', () => {
    expect(sortedTypeCounts(stats.typeCounts)).toEqual([
      ['Land', 10],
      ['Instant', 2],
      ['Creature', 2],
      ['Artifact', 1],
    ]);
  });

  it('reports zero average for a deck of only lands', () => {
    expect(computeDeckStats([card('Forest', { typeLine: 'Land' })]).avgNonlandCmc).toBe(0);
  });
});

describe('colorPieSlices', () => {
  it('returns no slices when there are no cards', () => {
    expect(colorPieSlices({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, 120)).toEqual([]);
  });

  it('draws a single colour as a full circle', () => {
    const [slice] = colorPieSlices({ W: 0, U: 0, B: 0, R: 3, G: 0, C: 0 }, 100);
    expect(slice.color).toBe('R');
    expect(slice.path).toBe('M 100 0 A 100 100 0 1 1 100 200 A 100 100 0 1 1 100 0 Z');
  });

  it('splits two equal colours into half-circle wedges in WUBRG order', () => {
    const slices = colorPieSlices({ W: 0, U: 1, B: 0, R: 0, G: 1, C: 0 }, 100);
    expect(slices.map((s) => s.color)).toEqual(['U', 'G']);
    expect(slices[0].path).toBe('M 100 100 L 100 0 A 100 100 0 0 1 100 200 Z');
  });
});
