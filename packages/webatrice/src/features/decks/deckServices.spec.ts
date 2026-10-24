import {
  decklistExportUrl,
  deckPrintHtml,
  deckstatsAnalyzeForm,
  parseDeckUrl,
  plainDeckText,
  tappedOutAnalyzeForm,
} from './deckServices';
import type { DeckCard, HydratedDeck } from './types';

const card = (name: string, quantity: number, overrides: Partial<DeckCard> = {}): DeckCard => ({
  name, quantity, category: 'main', lookupSource: 'scryfall', ...overrides,
});

const deck: HydratedDeck = {
  name: 'Burn & <Friends>',
  meta: { v: 1, updatedAt: 'x', description: 'Go fast' },
  format: 'modern',
  cards: [
    card('Lightning Bolt', 4, { set: 'm11', collectorNumber: '149' }),
    card('Fire // Ice', 2),
    card('Typo Card', 1, { lookupSource: 'unknown' }),
    card('Smash to Smithereens', 3, { category: 'sideboard' }),
  ],
};

describe('parseDeckUrl', () => {
  it.each([
    ['https://tappedout.net/mtg-decks/my-burn-deck/', 'tappedout', 'my-burn-deck',
      'https://tappedout.net/mtg-decks/my-burn-deck/?fmt=txt', 'https://tappedout.net/mtg-decks/my-burn-deck/?fmt=txt'],
    ['https://archidekt.com/decks/123456/burn', 'archidekt', '123456',
      'https://archidekt.com/api/decks/123456/?format=json', 'https://archidekt.com/decks/123456'],
    ['https://www.moxfield.com/decks/CKprD7MP-0ykuWLqAFkBLA', 'moxfield', 'CKprD7MP-0ykuWLqAFkBLA',
      'https://api.moxfield.com/v2/decks/all/CKprD7MP-0ykuWLqAFkBLA/', 'https://moxfield.com/decks/CKprD7MP-0ykuWLqAFkBLA'],
    ['https://deckstats.net/decks/42/1234-burn/en', 'deckstats', '42/1234-burn',
      'https://deckstats.net/decks/42/1234-burn?include_comments=1&export_mtgarena=1',
      'https://deckstats.net/decks/42/1234-burn?include_comments=1&export_mtgarena=1'],
  ])('%s → %s', (url, provider, deckId, apiUrl, handoffUrl) => {
    expect(parseDeckUrl(url)).toEqual(expect.objectContaining({ provider, deckId, apiUrl, handoffUrl }));
  });

  it('marks text exports and rejects other links', () => {
    expect(parseDeckUrl('https://tappedout.net/mtg-decks/x/')?.handoffIsText).toBe(true);
    expect(parseDeckUrl('https://moxfield.com/decks/x')?.handoffIsText).toBe(false);
    expect(parseDeckUrl('https://example.com/decks/1')).toBeNull();
  });
});

describe('plainDeckText', () => {
  it('writes main then sideboard, with SB: prefixes by default', () => {
    expect(plainDeckText(deck.cards)).toBe(
      '4 Lightning Bolt\n2 Fire // Ice\n1 Typo Card\nSB: 3 Smash to Smithereens\n',
    );
  });

  it('can drop the prefix and slash split cards for TappedOut', () => {
    expect(plainDeckText(deck.cards, { prefixSideboard: false, slashSplitCards: true }))
      .toBe('4 Lightning Bolt\n2 Fire / Ice\n1 Typo Card\n3 Smash to Smithereens\n');
  });
});

describe('decklistExportUrl', () => {
  it('builds the decklist query from main and side, with set and number', () => {
    const url = new URL(decklistExportUrl(deck, 'decklist.org')!);
    expect(url.origin).toBe('https://www.decklist.org');
    expect(url.searchParams.get('deckmain')).toBe('4 Lightning Bolt (M11) 149\n2 Fire // Ice\n1 Typo Card');
    expect(url.searchParams.get('deckside')).toBe('3 Smash to Smithereens');
    expect(decklistExportUrl(deck, 'decklist.xyz')).toMatch(/^https:\/\/www\.decklist\.xyz\/\?deckmain=/);
  });

  it('refuses an empty deck', () => {
    expect(decklistExportUrl({ ...deck, cards: [] }, 'decklist.org')).toBeNull();
  });
});

describe('analyze forms', () => {
  it('posts the plain list and title to deckstats, leaving out unknown cards', () => {
    expect(deckstatsAnalyzeForm(deck)).toEqual({
      action: 'https://deckstats.net/index.php',
      fields: {
        deck: '4 Lightning Bolt\n2 Fire // Ice\nSB: 3 Smash to Smithereens\n',
        decktitle: 'Burn & <Friends>',
      },
    });
  });

  it('posts name, mainboard and sideboard to TappedOut', () => {
    expect(tappedOutAnalyzeForm(deck)).toEqual({
      action: 'https://tappedout.net/mtg-decks/paste/',
      fields: {
        name: 'Burn & <Friends>',
        mainboard: '4 Lightning Bolt\n2 Fire / Ice\n',
        sideboard: '3 Smash to Smithereens\n',
      },
    });
  });
});

describe('deckPrintHtml', () => {
  it('prints the escaped name, the description and a table per zone', () => {
    const html = deckPrintHtml(deck, { main: 'Mainboard', sideboard: 'Sideboard' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('h1')?.textContent).toBe('Burn & <Friends>');
    expect(doc.querySelector('p')?.textContent).toBe('Go fast');
    expect(Array.from(doc.querySelectorAll('h2')).map((h) => h.textContent)).toEqual(['Mainboard', 'Sideboard']);
    const firstRow = doc.querySelector('tr')!;
    expect(Array.from(firstRow.cells).map((c) => c.textContent)).toEqual(['4', 'Lightning Bolt']);
  });

  it('skips empty zones', () => {
    const html = deckPrintHtml({ ...deck, cards: [card('Bolt', 1)] }, { main: 'Mainboard', sideboard: 'Sideboard' });
    expect(html).not.toContain('Sideboard');
  });
});
