import type { TFunction } from 'i18next';
import { lookupCards, parseCod, serializeCod } from '@app/services';

import desktopXml from './fixtures/desktop-plans.cod?raw';
import { buildImportedDeckCod, resolveImportEntries } from './deckImport';
import { exportDeck } from './deckExport';
import { deckSaveSignature, serializeDeckForSave } from './deckPersistence';
import { hydrateDeck } from './hydrate';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  lookupCards: vi.fn(),
  lookupCardsForHydration: vi.fn().mockResolvedValue({ lookups: new Map(), refreshed: Promise.resolve(new Map()) }),
}));

function plans(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(doc.querySelectorAll('sideboard_plan')).map((el) => new XMLSerializer().serializeToString(el));
}

it('keeps named and current desktop plans through parse and serialization', () => {
  const expected = plans(desktopXml);
  expect(expected).toHaveLength(2);
  expect(plans(serializeCod(parseCod(desktopXml)))).toEqual(expected);
});

it('keeps plans through import, hydration, an edited save and export', async () => {
  vi.mocked(lookupCards).mockResolvedValue(new Map());
  const expected = plans(desktopXml);
  const source = parseCod(desktopXml);
  const rows = await resolveImportEntries(source.cards);
  const t = ((key: string) => key) as unknown as TFunction;
  const imported = buildImportedDeckCod(source, rows, { name: 'Imported', format: 'modern', t });
  expect(plans(imported)).toEqual(expected);
  const hydrated = await hydrateDeck(parseCod(imported));
  hydrated.name = 'Edited';
  hydrated.cards[0].quantity = 3;
  expect(plans(serializeDeckForSave(hydrated))).toEqual(expected);
  expect(plans(exportDeck(hydrated, 'cockatrice'))).toEqual(expected);
});

it('includes sideboard plans in save dirty detection', async () => {
  vi.mocked(lookupCards).mockResolvedValue(new Map());
  const withPlans = await hydrateDeck(parseCod(desktopXml));
  const withoutPlans = await hydrateDeck(parseCod(desktopXml.replace(/<sideboard_plan>.*?<\/sideboard_plan>/g, '')));
  expect(deckSaveSignature(withPlans)).not.toBe(deckSaveSignature(withoutPlans));
});
