import { catalogT } from '../__test-utils__/catalogT';
import menuText from '../components/context-menus/menus.i18n.json';

const t = catalogT(menuText);

import { computeTally, type TallyCard } from './tally';

const card = (name: string, pt = '', faceDown = false): TallyCard => ({ name, pt, faceDown });

const TYPES: Record<string, string> = {
  'Goblin Guide': 'Creature — Goblin Scout',
  'Krenko': 'Legendary Creature — Goblin Warrior',
  'Delver': 'Creature — Human Wizard // Creature — Human Insect',
  'Bolt': 'Instant',
};
const typeLineOf = (name: string) => TYPES[name];

describe('computeTally', () => {
  it('counts subtypes across faces, skipping face-down cards, by count then name', () => {
    expect(computeTally(t,
      [card('Goblin Guide'), card('Krenko'), card('Delver'), card('Bolt'), card('Krenko', '', true)],
      'subtypes',
      typeLineOf,
    )).toEqual([
      { name: 'Insect', value: '1' },
      { name: 'Scout', value: '1' },
      { name: 'Warrior', value: '1' },
      { name: 'Wizard', value: '1' },
      { name: 'Goblin', value: '2' },
      { name: 'Human', value: '2' },
    ]);
  });

  it.each([
    ['3/1', '2/2', 'power', '5'],
    ['3/1', '2/2', 'toughness', '3'],
    ['*/1', 'X/2', 'power', '0'],
    ['-1/3', '+2/-4', 'power', '2'],
    ['-1/3', '+2/-4', 'toughness', '3'],
    ['1+*/2', '4', 'power', '4'],
    ['1+*/2', '4', 'toughness', '2'],
  ])('sums %s and %s as %s %s', (a, b, type, value) => {
    const rows = computeTally(t, [card('A', a), card('B', b)], type as 'power' | 'toughness', typeLineOf);
    expect(rows.map((r) => r.value)).toEqual([value]);
  });

  it('labels the totals', () => {
    expect(computeTally(t, [card('A', '1/1')], 'power', typeLineOf)).toEqual([{ name: 'Total Power', value: '1' }]);
    expect(computeTally(t, [card('A', '1/1')], 'toughness', typeLineOf)).toEqual([{ name: 'Total Toughness', value: '1' }]);
  });

  it('has no rows when no card has a P/T, or for None', () => {
    expect(computeTally(t, [card('Bolt'), card('Krenko')], 'power', typeLineOf)).toEqual([]);
    expect(computeTally(t, [card('A', '1/1')], 'none', typeLineOf)).toEqual([]);
  });
});
