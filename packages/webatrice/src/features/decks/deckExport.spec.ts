import { parseCod } from '@app/services';

import desktopMetadata from './fixtures/desktop-metadata.cod?raw';
import { parseDecklist } from './decklistParser';
import { exportDeck, exportFileName, toArenaText, toPlainText } from './deckExport';
import type { DeckCard, HydratedDeck } from './types';

function card(name: string, overrides: Partial<DeckCard> = {}): DeckCard {
  return { name, quantity: 1, category: 'main', lookupSource: 'scryfall', ...overrides };
}

const cards: DeckCard[] = [
  card('Atraxa', { isCommander: true, set: 'one', collectorNumber: '196' }),
  card('Lightning Bolt', { quantity: 4, set: 'm11', collectorNumber: '149' }),
  card('Forest', { quantity: 10 }),
  card('Negate', { category: 'sideboard', quantity: 2, set: 'm20' }),
];

describe('toPlainText', () => {
  it('lists the commander once, then the deck and the sideboard', () => {
    expect(toPlainText(cards)).toBe([
      '// Commander', '1 Atraxa', '',
      '// Deck', '4 Lightning Bolt', '10 Forest', '',
      '// Sideboard', 'SB: 2 Negate',
    ].join('\n'));
  });

  it('omits empty sections without leading blank lines', () => {
    expect(toPlainText([card('Forest')])).toBe('// Deck\n1 Forest');
    expect(toPlainText([])).toBe('');
  });
});

describe('toArenaText', () => {
  it('adds set and collector number only when both are known', () => {
    expect(toArenaText(cards)).toBe([
      'Commander', '1 Atraxa (ONE) 196', '',
      'Deck', '4 Lightning Bolt (M11) 149', '10 Forest', '',
      'Sideboard', '2 Negate',
    ].join('\n'));
  });
});

describe('exportDeck', () => {
  const deck: HydratedDeck = {
    name: 'Superfriends',
    meta: { v: 1, updatedAt: '2026-01-01T00:00:00.000Z', description: 'd' },
    cards,
    format: 'commander',
    bannerCard: 'Atraxa',
    bracketAssessment: {
      level: 3, fingerprint: 'abcdefgh', gameChangers: [], turns: [], turnsRestricted: [],
      denial: [], denialRestricted: [], earlyCombos: [], lateCombos: [],
    },
  };

  it('writes a lossless .cod for Cockatrice, without the cached bracket assessment', () => {
    const parsed = parseCod(exportDeck(deck, 'cockatrice'));
    expect(parsed.name).toBe('Superfriends');
    expect(parsed.format).toBe('commander');
    expect(parsed.bannerCard).toBe('Atraxa');
    expect(parsed.meta.description).toBe('d');
    expect(parsed.cards.find((c) => c.name === 'Atraxa')?.isCommander).toBe(true);
    expect(parsed.bracketAssessment).toBeUndefined();
  });

  it('dispatches the text formats', () => {
    expect(exportDeck(deck, 'plain')).toBe(toPlainText(cards));
    expect(exportDeck(deck, 'arena')).toBe(toArenaText(cards));
  });
});

describe('exportFileName', () => {
  it('slugifies the deck name', () => {
    expect(exportFileName('  Atraxa: Superfriends!! ', 'cod')).toBe('atraxa-superfriends.cod');
    expect(exportFileName('???', 'txt')).toBe('deck.txt');
  });
});


it.each(['plain', 'arena'] as const)('round-trips quantities, zones and commanders through %s export', (format) => {
  const deck: HydratedDeck = { name: 'Round trip', format: 'commander', meta: { v: 1, updatedAt: 'x' }, cards };
  const parsed = parseDecklist(exportDeck(deck, format));
  expect(parsed.ignored).toEqual([]);
  expect(parsed.entries.map((c) => [c.name, c.quantity, c.category, !!c.isCommander]))
    .toEqual(cards.map((c) => [c.name, c.quantity, c.category, !!c.isCommander]));
});

it('reads section markers from older commented exports', () => {
  expect(parseDecklist('// Commander\n1 Atraxa\n// Deck\n4 Forest\n// Sideboard\n2 Negate').entries
    .map((c) => [c.name, c.quantity, c.category, !!c.isCommander])).toEqual([
    ['Atraxa', 1, 'main', true], ['Forest', 4, 'main', false], ['Negate', 2, 'sideboard', false],
  ]);
});


it('exports desktop banner printing and playmat metadata through the real .cod adapter', () => {
  const source = parseCod(desktopMetadata);
  const hydrated: HydratedDeck = {
    ...source,
    cards: source.cards.map((c) => ({ ...c, lookupSource: 'unknown' })),
  };
  const exported = parseCod(exportDeck(hydrated, 'cockatrice'));
  expect(exported.bannerCardProviderId).toBe('banner-printing-id');
  expect(exported.playmatXml).toBe('<playmatCard providerId="playmat-printing-id">Island</playmatCard>');
  expect(exported.tagsXml).toBe(source.tagsXml);
  expect(exported.lastLoadedTimestamp).toBe(source.lastLoadedTimestamp);
});
