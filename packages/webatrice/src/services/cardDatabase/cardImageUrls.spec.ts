import type { Card, SetPreference } from '../dexie/types';
import { printingProperties, resolveCardImageUrls, resolvePrintingImageUrls } from './cardImageUrls';

const pref = (code: string, sortKey: number, enabled = true): SetPreference => ({
  code, sortKey, enabled, isKnown: true,
});

const printings = [
  { value: 'LEA', uuid: 'aaaa', muid: '209' },
  { value: 'M10', uuid: 'bbbb', picURL: 'https://mirror.example/m10/bolt.jpg' },
  { value: 'OFF', uuid: 'cccc' },
];

const card: Card = {
  name: { value: 'Lightning Bolt' },
  prop: { value: { side: { value: 'front' } } },
  set: printings,
};

const templates = ['https://img.example/!setcode!/!set:uuid!.jpg'];
const scryfallByName = (name: string) =>
  `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=normal`;

describe('cardImageUrls', () => {
  it('uses the pinned printing ahead of set preferences', () => {
    const urls = resolveCardImageUrls(card, { templates, setPreferences: new Map(), pinnedPrintingId: 'cccc' });
    expect(urls[0]).toBe('https://img.example/OFF/cccc.jpg');
  });

  it('renders a stale pin by name without choosing a different printing', () => {
    expect(resolveCardImageUrls(card, {
      templates: ['https://img.example/!name!.jpg', ...templates],
      setPreferences: new Map(),
      pinnedPrintingId: 'missing',
    })).toEqual(['https://img.example/Lightning%20Bolt.jpg', scryfallByName('Lightning Bolt')]);
  });

  it('folds picURL into picurl and drops the set code value', () => {
    expect(printingProperties({ value: 'M10', picURL: 'u', num: '1' })).toEqual({ picurl: 'u', num: '1' });
  });

  it('puts a printing\'s own picurl ahead of its templates', () => {
    expect(resolvePrintingImageUrls(card, printings[1], { templates })).toEqual([
      'https://mirror.example/m10/bolt.jpg',
      'https://img.example/M10/bbbb.jpg',
    ]);
  });

  it('walks printings in set-priority order and ends with the Scryfall by-name fallback', () => {
    const setPreferences = new Map([
      ['LEA', pref('LEA', 1)],
      ['M10', pref('M10', 0)],
      ['OFF', pref('OFF', 2, false)],
    ]);
    expect(resolveCardImageUrls(card, { templates, setPreferences })).toEqual([
      'https://mirror.example/m10/bolt.jpg',
      'https://img.example/M10/bbbb.jpg',
      'https://img.example/LEA/aaaa.jpg',
      'https://img.example/OFF/cccc.jpg',
      scryfallByName('Lightning Bolt'),
    ]);
  });

  it('tries the preferred printing first', () => {
    const urls = resolveCardImageUrls(card, { templates, setPreferences: new Map(), preferredSet: 'OFF' });
    expect(urls[0]).toBe('https://img.example/OFF/cccc.jpg');
  });

  it('still resolves name-only templates for a card with no printings', () => {
    const urls = resolveCardImageUrls(
      { name: { value: 'Goblin' } },
      { templates: ['https://img.example/!name!.jpg', ...templates], setPreferences: new Map() },
    );
    expect(urls).toEqual(['https://img.example/Goblin.jpg', scryfallByName('Goblin')]);
  });

  it('removes duplicate candidates', () => {
    const urls = resolveCardImageUrls(card, {
      templates: ['https://img.example/!name!.jpg'],
      setPreferences: new Map(),
    });
    expect(urls.filter((u) => u === 'https://img.example/Lightning%20Bolt.jpg')).toHaveLength(1);
  });
});
