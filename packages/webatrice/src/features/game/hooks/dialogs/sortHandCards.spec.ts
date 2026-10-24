import { sortHandCards, type HandSortCard } from './sortHandCards';
import type { HandSortKey } from './gameDialogs.types';

function entry(id: number, name: string, properties?: Record<string, string>, providerId = ''): HandSortCard {
  return {
    card: { id, name, providerId },
    metadata: properties === undefined ? undefined : {
      prop: { value: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, { value }])) },
    },
  };
}

describe('sortHandCards desktop comparison', () => {
  it('uses case-sensitive UTF-16 names, then printing IDs, without mutating the input', () => {
    const cards = [
      entry(1, 'apple'), entry(2, 'Zebra', undefined, 'a'),
      entry(3, 'Zebra', undefined, 'Z'), entry(4, 'Zebra'),
    ];
    expect(sortHandCards(cards, 'name')).toEqual([4, 3, 2, 1]);
    expect(cards.map(({ card }) => card.id)).toEqual([1, 2, 3, 4]);
  });

  it('sorts main type by mana value before name, then printing, without a color tie-break', () => {
    expect(sortHandCards([
      entry(1, 'Alpha', { maintype: 'Creature', cmc: '10' }),
      entry(2, 'Zulu', { maintype: 'Creature', cmc: '2', colors: 'W' }),
      entry(3, 'Alpha', { maintype: 'Creature', cmc: '2', colors: 'G' }, 'b'),
      entry(4, 'Alpha', { maintype: 'Creature', cmc: '2', colors: 'G' }, 'a'),
      entry(5, 'Zulu', { maintype: 'Artifact', cmc: '20' }),
    ], 'maintype')).toEqual([5, 4, 3, 2, 1]);
  });

  it('uses database cmc rather than estimating X, hybrid or unbraced mana symbols', () => {
    expect(sortHandCards([
      entry(1, 'Alpha', { cmc: '10', manacost: 'X' }),
      entry(2, 'Zulu', { cmc: '2', manacost: '{10}' }),
      entry(3, 'Beta', { cmc: '0', manacost: '{X}{X}' }),
      entry(4, 'Gamma', { cmc: '1', manacost: '{2/W}' }),
    ], 'manacost')).toEqual([3, 4, 2, 1]);
  });

  it('preserves desktop string padding even for fractional and longer custom values', () => {
    expect(sortHandCards([
      entry(1, 'A', { cmc: '1.5' }), entry(2, 'B', { cmc: '2' }),
      entry(3, 'C', { cmc: '10000' }), entry(4, 'D', { cmc: '9999' }),
    ], 'manacost')).toEqual([2, 1, 3, 4]);
  });

  it('breaks mana-value ties by lands, colorless, WUBRG, custom colors and multicolor strings', () => {
    const colors = ['', '', 'W', 'U', 'B', 'R', 'G', 'A', 'Z', 'BR', 'WU', 'WUB', 'WUBR', 'WUBRG'];
    const cards = colors.map((color, index) => entry(index, String(100 - index), {
      cmc: '0', colors: color, type: index === 0 ? 'Basic Land' : 'Creature',
    }));
    expect(sortHandCards([...cards].reverse(), 'manacost')).toEqual(colors.map((_, index) => index));
  });

  it('breaks matching mana-value and color ties by name and printing, not mana cost', () => {
    expect(sortHandCards([
      entry(1, 'Zulu', { cmc: '2', colors: 'W', manacost: 'A' }),
      entry(2, 'Alpha', { cmc: '2', colors: 'W', manacost: 'Z' }, 'b'),
      entry(3, 'Alpha', { cmc: '2', colors: 'W', manacost: 'Z' }, 'a'),
    ], 'manacost')).toEqual([3, 2, 1]);
  });

  it.each<HandSortKey>(['maintype', 'manacost'])('sorts missing metadata before a known card with missing cmc for %s', (key) => {
    expect(sortHandCards([entry(1, 'Alpha', {}), entry(2, 'Zulu')], key)).toEqual([2, 1]);
  });

  it.each<HandSortKey>(['name', 'maintype', 'manacost'])('does not invent an ID tie-break for identical %s keys', (key) => {
    expect(sortHandCards([entry(9, 'Same', {}), entry(2, 'Same', {})], key)).toEqual([9, 2]);
  });
});
