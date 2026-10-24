import { lookupCards, parseCod, type LookupResult } from '@app/services';
import type { TFunction } from 'i18next';

import type { ParsedDeck } from '@app/types';

import {
  buildImportedDeckCod,
  countResolvedRows,
  resolveImportEntries,
  summarizeImportRows,
  type ImportEntry,
} from './deckImport';
import desktopMetadata from './fixtures/desktop-metadata.cod?raw';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCards: vi.fn(),
}));

const t = ((key: string) => key) as unknown as TFunction;

const solRing: LookupResult = {
  found: true,
  source: 'scryfall',
  name: 'Sol Ring',
  typeLine: 'Artifact',
  printings: [{ set: 'c21', collectorNumber: '263', scryfallId: 'id-sol' }],
};

beforeEach(() => {
  vi.mocked(lookupCards).mockReset();
});

describe('resolveImportEntries', () => {
  it('looks each printing up once, batching one printing per name per request, and keeps unknown names', async () => {
    vi.mocked(lookupCards).mockResolvedValue(new Map([['Sol Ring', solRing]]));
    const entries: ImportEntry[] = [
      { name: 'Sol Ring', quantity: 1, category: 'main', set: 'C21', collectorNumber: '263' },
      { name: 'Sol Ring', quantity: 1, category: 'sideboard' },
      { name: 'Mystery', quantity: 2, category: 'main' },
    ];

    const rows = await resolveImportEntries(entries);

    expect(vi.mocked(lookupCards).mock.calls.map(([hints]) => hints)).toEqual([
      [{ name: 'Sol Ring', set: 'C21', collectorNumber: '263' }, { name: 'Mystery' }],
      [{ name: 'Sol Ring' }],
    ]);
    expect(rows.map((r) => [r.entry.name, r.lookup.found])).toEqual([
      ['Sol Ring', true],
      ['Sol Ring', true],
      ['Mystery', false],
    ]);
    expect(rows[2].lookup).toEqual({ found: false, source: 'unknown', name: 'Mystery', printings: [] });
    expect(countResolvedRows(rows)).toEqual({ matched: 2, missing: 2 });
  });

  it('drops only the printing that failed, keeping a valid printing of the same card', async () => {
    const missing: LookupResult = { found: false, source: 'unknown', name: 'Sol Ring', printings: [] };
    vi.mocked(lookupCards)
      .mockResolvedValueOnce(new Map([['Sol Ring', missing]]))
      .mockResolvedValueOnce(new Map([['Sol Ring', solRing]]))
      .mockResolvedValueOnce(new Map([['Sol Ring', solRing]]));
    const rows = await resolveImportEntries([
      { name: 'Sol Ring', quantity: 1, category: 'main', set: '2XM', collectorNumber: '300' },
      { name: 'Sol Ring', quantity: 1, category: 'sideboard', set: 'C21', collectorNumber: '263', scryfallId: 'id-sol' },
    ]);
    expect(rows.map((r) => r.hintDropped ?? false)).toEqual([true, false]);
    const deck: ParsedDeck = { name: 'D', meta: { v: 1, updatedAt: 'x' }, cards: [], format: '' };
    expect(parseCod(buildImportedDeckCod(deck, rows, { name: '', format: '', t })).cards).toEqual([
      { name: 'Sol Ring', quantity: 1, category: 'main' },
      { name: 'Sol Ring', quantity: 1, category: 'sideboard', set: 'C21', collectorNumber: '263', scryfallId: 'id-sol' },
    ]);
  });

  it('falls back to the name when a printing hint finds nothing, and drops that hint', async () => {
    vi.mocked(lookupCards)
      .mockResolvedValueOnce(new Map([['Sol Ring', { found: false, source: 'unknown', name: 'Sol Ring', printings: [] }]]))
      .mockResolvedValueOnce(new Map([['Sol Ring', solRing]]));
    const rows = await resolveImportEntries([
      { name: 'Sol Ring', quantity: 1, category: 'main', set: '2XM', collectorNumber: '300', scryfallId: 'desktop-only-id' },
    ]);

    expect(vi.mocked(lookupCards).mock.calls[1][0]).toEqual(['Sol Ring']);
    expect(rows[0]).toMatchObject({ lookup: { found: true }, hintDropped: true });
    const deck: ParsedDeck = { name: 'D', meta: { v: 1, updatedAt: 'x' }, cards: [], format: '' };
    const card = parseCod(buildImportedDeckCod(deck, rows, { name: '', format: '', t })).cards[0];
    expect(card).toEqual({ name: 'Sol Ring', quantity: 1, category: 'main' });
  });

  it('writes only the printing the source named, never a looked-up default', async () => {
    vi.mocked(lookupCards).mockResolvedValue(new Map([['Sol Ring', solRing]]));
    const rows = await resolveImportEntries([{ name: 'Sol Ring', quantity: 1, category: 'main' }]);
    const deck: ParsedDeck = { name: 'D', meta: { v: 1, updatedAt: 'x' }, cards: [], format: '' };
    expect(parseCod(buildImportedDeckCod(deck, rows, { name: '', format: '', t })).cards[0])
      .toEqual({ name: 'Sol Ring', quantity: 1, category: 'main' });
  });
});

describe('buildImportedDeckCod', () => {
  const file: ParsedDeck = {
    name: 'From Desktop',
    meta: { v: 1, updatedAt: '2026-01-01T00:00:00.000Z', description: 'kept', priceUsd: 9 },
    format: 'legacy',
    bannerCard: 'Sol Ring',
    lastLoadedTimestamp: '2026-01-02',
    extraZonesXml: ['<zone name="tokens"><card number="1" name="Goblin"/></zone>'],
    cards: [
      { name: 'Lightning Bolt', quantity: 4, category: 'main', set: 'm11', collectorNumber: '149' },
      { name: 'Negate', quantity: 2, category: 'sideboard' },
    ],
  };
  const unknown = (entry: ImportEntry) => ({
    entry, lookup: { found: false, source: 'unknown' as const, name: entry.name, printings: [] },
  });

  it('keeps the file\'s name, format, notes, extra zones and metadata unless the user typed their own', () => {
    const rows = file.cards.map(unknown);
    const kept = parseCod(buildImportedDeckCod(file, rows, { name: '', format: 'legacy', t }));
    expect(kept.name).toBe('From Desktop');
    expect(kept.format).toBe('legacy');
    expect(kept.meta.description).toBe('kept');
    expect(kept.bannerCard).toBe('Sol Ring');
    expect(kept.lastLoadedTimestamp).toBe('2026-01-02');
    expect(kept.extraZonesXml).toEqual(file.extraZonesXml);
    expect(kept.cards[0]).toEqual(expect.objectContaining({ set: 'm11', collectorNumber: '149' }));

    const renamed = parseCod(buildImportedDeckCod(file, rows, { name: ' Mine ', format: 'Vintage', t }));
    expect(renamed.name).toBe('Mine');
    expect(renamed.format).toBe('vintage');
  });

  it('falls back to a default name and leaves the format unset', () => {
    const deck = parseCod(buildImportedDeckCod({ ...file, name: '' }, [], { name: ' ', format: '', t }));
    expect(deck.name).toBe('DeckImport.defaultName');
    expect(deck.format).toBe('');
  });

  it('summarizes card totals per zone', () => {
    expect(summarizeImportRows(file.cards.map(unknown))).toEqual({ total: 6, main: 4, sideboard: 2 });
  });
});

it('imports desktop banner printing and playmat metadata through the real .cod adapter', async () => {
  vi.mocked(lookupCards).mockResolvedValue(new Map());
  const source = parseCod(desktopMetadata);
  const rows = await resolveImportEntries(source.cards);
  const imported = parseCod(buildImportedDeckCod(source, rows, { name: 'Renamed', format: 'modern', t }));
  expect(imported.name).toBe('Renamed');
  expect(imported.bannerCardProviderId).toBe('banner-printing-id');
  expect(imported.playmatXml).toBe('<playmatCard providerId="playmat-printing-id">Island</playmatCard>');
  expect(imported.tagsXml).toBe(source.tagsXml);
  expect(imported.lastLoadedTimestamp).toBe(source.lastLoadedTimestamp);
});
