import type { TFunction } from 'i18next';

import type { ParsedDeck } from '@app/types';

import {
  deckArtUrl,
  deckListSectionOf,
  deckSectionLabel,
  formatDisplayLabel,
  groupDecksByFormat,
  summarizeDeck,
  summariesEqual,
  type DeckSummary,
} from './deckSummary';
import type { FlatDeck } from './deckTree';

const t = ((key: string) => key) as unknown as TFunction;

function parsed(overrides: Partial<ParsedDeck>): ParsedDeck {
  return {
    name: 'Deck',
    meta: { v: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
    cards: [],
    format: '',
    ...overrides,
  } as ParsedDeck;
}

describe('summarizeDeck', () => {
  it('extracts price, format, banner and the first commander', () => {
    const summary = summarizeDeck(parsed({
      format: 'commander',
      bannerCard: 'Sol Ring',
      meta: { v: 1, updatedAt: 'x', priceUsd: 12.5, priceMissingCount: 1, bracketLevel: 2 },
      cards: [
        { name: 'Forest', quantity: 3, category: 'main' },
        { name: 'Atraxa', quantity: 1, category: 'main', isCommander: true, scryfallId: 'id-a' },
        { name: 'Island', quantity: 2, category: 'sideboard' },
      ],
    }));
    expect(summary).toEqual({
      usd: 12.5,
      missing: 1,
      bracketLevel: 2,
      format: 'commander',
      bannerCard: 'Sol Ring',
      commanderName: 'Atraxa',
      commanderScryfallId: 'id-a',
      cardCount: 4,
    });
  });

  it('reads the tags and the banner printing', () => {
    const summary = summarizeDeck(parsed({
      bannerCard: 'Sol Ring',
      bannerCardProviderId: 'p1',
      tagsXml: '<tags><tag>Ramp</tag><tag>Artifacts</tag></tags>',
    }));
    expect(summary.tags).toEqual(['Ramp', 'Artifacts']);
    expect(summary.bannerCardProviderId).toBe('p1');
    expect(summarizeDeck(parsed({})).tags).toBeUndefined();
  });

  it('prefers the bracket assessment level over the legacy meta level', () => {
    const summary = summarizeDeck(parsed({
      meta: { v: 1, updatedAt: 'x', bracketLevel: 2 },
      bracketAssessment: {
        level: 4, fingerprint: 'f', gameChangers: [], turns: [], turnsRestricted: [],
        denial: [], denialRestricted: [], earlyCombos: [], lateCombos: [],
      },
    }));
    expect(summary.bracketLevel).toBe(4);
    expect(summary.format).toBeUndefined();
  });
});

describe('summariesEqual', () => {
  it('compares every summary field', () => {
    const a: DeckSummary = { usd: 1, format: 'modern' };
    expect(summariesEqual(a, { ...a })).toBe(true);
    expect(summariesEqual(a, { ...a, commanderName: 'X' })).toBe(false);
    expect(summariesEqual({ ...a, tags: ['A'] }, { ...a, tags: ['A'] })).toBe(true);
    expect(summariesEqual({ ...a, tags: ['A'] }, { ...a, tags: ['B'] })).toBe(false);
    expect(summariesEqual(a, { ...a, bannerCardProviderId: 'p' })).toBe(false);
  });
});

describe('deckArtUrl', () => {
  it('prefers the banner card, then the commander printing, then the commander name', () => {
    expect(deckArtUrl({ bannerCard: ' Sol Ring ', commanderScryfallId: 'id' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Sol%20Ring&format=image&version=art_crop');
    expect(deckArtUrl({ commanderScryfallId: 'id-a', commanderName: 'Atraxa' }))
      .toBe('https://api.scryfall.com/cards/id-a?format=image&version=art_crop');
    expect(deckArtUrl({ commanderName: 'Atraxa, Grand Unifier' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Atraxa%2C%20Grand%20Unifier&format=image&version=art_crop');
    expect(deckArtUrl({ bannerCard: 'Sol Ring', bannerCardProviderId: '0afa0e33-4804-4b00-b625-c2d6b61090fc' }))
      .toBe('https://api.scryfall.com/cards/0afa0e33-4804-4b00-b625-c2d6b61090fc?format=image&version=art_crop');
    expect(deckArtUrl({ bannerCard: 'Sol Ring', bannerCardProviderId: 'not-a-uuid' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Sol%20Ring&format=image&version=art_crop');
    expect(deckArtUrl({ bannerCard: '  ' })).toBeNull();
    expect(deckArtUrl(undefined)).toBeNull();
  });
});

describe('formatDisplayLabel', () => {
  it('labels known formats and capitalises custom ones', () => {
    expect(formatDisplayLabel(' PauperCommander ', t)).toBe('DeckFormat.paupercommander');
    expect(formatDisplayLabel('netrunner', t)).toBe('Netrunner');
  });
});

describe('format sections', () => {
  const deck = (id: number): FlatDeck => ({ id, name: `D${id}`, path: '', creationTime: 0, visibility: 'private' });

  it('classifies loading, unknown, known and custom formats', () => {
    expect(deckListSectionOf(undefined)).toBe('loading');
    expect(deckListSectionOf({ format: undefined })).toBe('unknown');
    expect(deckListSectionOf({ format: 'Modern' })).toBe('modern');
    expect(deckListSectionOf({ format: 'cube' })).toBe('other');
  });

  it('groups decks in canonical format order, keeping their order within a section', () => {
    const summaries = new Map<number, DeckSummary>([
      [1, { format: 'modern' }],
      [2, { format: 'commander' }],
      [3, { format: 'cube' }],
      [5, {}],
      [6, { format: 'modern' }],
    ]);
    const sections = groupDecksByFormat([deck(1), deck(2), deck(3), deck(4), deck(5), deck(6)], summaries);
    expect(sections.map((s) => [s.section, s.decks.map((d) => d.id)])).toEqual([
      ['commander', [2]],
      ['modern', [1, 6]],
      ['other', [3]],
      ['loading', [4]],
      ['unknown', [5]],
    ]);
    expect(sections.map((s) => deckSectionLabel(s.section, t))).toEqual([
      'DeckFormat.commander', 'DeckFormat.modern', 'DeckSummary.section.other', 'Common.status.loading', 'DeckSummary.section.unknown',
    ]);
  });
});
