import type { TFunction } from 'i18next';

import { lookupCards, printingKey, printingRounds, serializeCod, type LookupHint, type LookupResult } from '@app/services';
import type { DeckCategory, ParsedCard, ParsedDeck } from '@app/types';

import { deckColorIdentity } from './deckPersistence';
import { assembleDeckCard } from './hydrate';
import type { DeckCard } from './types';

export type ImportEntry = Omit<ParsedCard, 'category'> & { category: DeckCategory };

export interface ResolvedImportRow {
  entry: ImportEntry;
  lookup: LookupResult;
  hintDropped?: boolean;
}

function unknownLookup(name: string): LookupResult {
  return { found: false, source: 'unknown', name, printings: [] };
}

function hasHint(entry: ImportEntry): boolean {
  return Boolean(entry.set || entry.collectorNumber || entry.scryfallId);
}

function hintOf(entry: ImportEntry): LookupHint {
  return {
    name: entry.name,
    ...(entry.set ? { set: entry.set } : {}),
    ...(entry.collectorNumber ? { collectorNumber: entry.collectorNumber } : {}),
    ...(entry.scryfallId ? { scryfallId: entry.scryfallId } : {}),
  };
}

export interface ImportLookups {
  hinted: Map<string, LookupResult>;
  byName: Map<string, LookupResult>;
}

export async function lookupImportEntries(entries: readonly ImportEntry[]): Promise<ImportLookups> {
  const hinted = new Map<string, LookupResult>();
  for (const round of printingRounds(entries.map(hintOf))) {
    const found = await lookupCards(round);
    for (const hint of round) {
      hinted.set(printingKey(hint), found.get(hint.name) ?? unknownLookup(hint.name));
    }
  }
  const missedNames = new Set(entries.filter((e) => hasHint(e) && !hinted.get(printingKey(hintOf(e)))?.found).map((e) => e.name));
  const byName = missedNames.size ? await lookupCards([...missedNames]) : new Map<string, LookupResult>();
  return { hinted, byName };
}

export function resolveWithLookups(entries: readonly ImportEntry[], { hinted, byName }: ImportLookups): ResolvedImportRow[] {
  return entries.map((entry) => {
    const hit = hinted.get(printingKey(hintOf(entry)));
    if (hit?.found) {
      return { entry, lookup: hit };
    }
    const named = hasHint(entry) ? byName.get(entry.name) : undefined;
    if (named?.found) {
      return { entry, lookup: named, hintDropped: true };
    }
    return { entry, lookup: hit ?? unknownLookup(entry.name) };
  });
}

export async function resolveImportEntries(entries: readonly ImportEntry[]): Promise<ResolvedImportRow[]> {
  return resolveWithLookups(entries, await lookupImportEntries(entries));
}

function sourceCard({ entry, hintDropped }: ResolvedImportRow): ParsedCard {
  return hintDropped
    ? { name: entry.name, quantity: entry.quantity, category: entry.category, isCommander: entry.isCommander, zonePath: entry.zonePath }
    : entry;
}

function rowCard(row: ResolvedImportRow): DeckCard {
  return assembleDeckCard(sourceCard(row), row.lookup);
}

export function resolvedImportColorIdentity(rows: readonly ResolvedImportRow[]): string {
  return deckColorIdentity(rows.map(rowCard));
}

export function countResolvedRows(rows: readonly ResolvedImportRow[]): { matched: number; missing: number } {
  let matched = 0;
  let missing = 0;
  for (const r of rows) {
    if (r.lookup.found) {
      matched += r.entry.quantity;
    } else {
      missing += r.entry.quantity;
    }
  }
  return { matched, missing };
}

export function buildImportedDeckCod(
  deck: ParsedDeck,
  rows: readonly ResolvedImportRow[],
  { name, format, t }: { name: string; format: string; t: TFunction },
): string {
  return serializeCod({
    name: name.trim() || deck.name || t('DeckImport.defaultName'),
    meta: deck.meta,
    cards: rows.map(sourceCard),
    format: format.trim().toLowerCase(),
    bannerCard: deck.bannerCard,
    bannerCardProviderId: deck.bannerCardProviderId,
    lastLoadedTimestamp: deck.lastLoadedTimestamp,
    playmatXml: deck.playmatXml,
    sideboardPlansXml: deck.sideboardPlansXml,
    extraZonesXml: deck.extraZonesXml,
    tagsXml: deck.tagsXml,
  });
}

export function summarizeImportRows(rows: readonly ResolvedImportRow[]): { total: number; main: number; sideboard: number } {
  let main = 0;
  let sideboard = 0;
  for (const { entry } of rows) {
    if (entry.category === 'sideboard') {
      sideboard += entry.quantity;
    } else {
      main += entry.quantity;
    }
  }
  return { total: main + sideboard, main, sideboard };
}
