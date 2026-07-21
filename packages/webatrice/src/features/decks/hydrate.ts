import { ScryfallImageSize } from '@cockatrice/datatrice';

import { lookupCards, type LookupResult, type PrintingSummary } from './cardLookup';
import { parseCod } from './cod';
import type { DeckCard, HydratedDeck, ParsedCard, ParsedDeck } from './types';

/**
 * Top-level "load a deck" pipeline: raw `.cod` XML → structured
 * `ParsedDeck` → hydrated `HydratedDeck` with per-card metadata and
 * chosen printings. This is what MyDecks / DeckEditor call after
 * `deckDownload(id)` returns.
 *
 * The hydration step:
 *   1. Bulk-lookup every unique card name (Dexie + Scryfall fallback).
 *   2. For each ParsedCard, pick a printing — user's XML hint if
 *      present, else newest from the lookup result.
 *   3. Merge card metadata + chosen printing into a DeckCard.
 *
 * Cards not found anywhere still render as `DeckCard`s with only
 * `name`/`quantity`/`category` populated + `lookupSource: 'unknown'`,
 * so the UI can flag them without special-casing missing rows.
 */

export async function hydrateDeck(parsed: ParsedDeck): Promise<HydratedDeck> {
  const uniqueNames = Array.from(new Set(parsed.cards.map((c) => c.name)));
  const lookups = await lookupCards(uniqueNames);

  const cards: DeckCard[] = parsed.cards.map((row) => {
    const lookup = lookups.get(row.name);
    return assembleDeckCard(row, lookup);
  });

  return {
    name: parsed.name,
    meta: parsed.meta,
    cards,
    // Default an absent/empty <format> element to `commander`. Older
    // decks (created before format support landed, or in tools that
    // don't set the field) get treated as commander decks in the
    // editor and the next autosave writes the element back into the
    // file. Callers that opened the deck read-only and never mutate
    // won't trigger a persist — the useDeckEditor DECK_DOWNLOADED
    // handler nudges an immediate save when the raw parse had no
    // format, so the file still catches up on first open.
    format: parsed.format?.trim() || 'commander',
    bannerCard: parsed.bannerCard,
    lastLoadedTimestamp: parsed.lastLoadedTimestamp,
    tagsXml: parsed.tagsXml,
    bracketAssessment: parsed.bracketAssessment,
  };
}

/** Convenience: fetch → parse → hydrate in one call. */
export async function loadDeckFromCod(xml: string): Promise<HydratedDeck> {
  return hydrateDeck(parseCod(xml));
}

/**
 * Merge a parsed card row with its lookup result into a renderable
 * DeckCard. Printing selection priority:
 *   1. If the parsed row has an XML hint (`set` / `collectorNumber` /
 *      `scryfallId`), find the matching printing in the lookup —
 *      prefer scryfallId match, fall back to (set + collector) match.
 *   2. Otherwise take the last entry in `printings[]` (newest).
 *   3. If the lookup has no printings, emit an empty printing (no set/
 *      image); the row still renders but as a text-only entry.
 */
export function assembleDeckCard(
  row: ParsedCard,
  lookup: LookupResult | undefined,
): DeckCard {
  if (!lookup || !lookup.found) {
    return {
      name: row.name,
      quantity: row.quantity,
      category: row.category,
      set: row.set,
      collectorNumber: row.collectorNumber,
      scryfallId: row.scryfallId,
      lookupSource: 'unknown',
    };
  }

  const chosen = pickPrinting(row, lookup.printings);

  // When the hint identifies a printing that Dexie doesn't know about
  // (user picked a Scryfall-only printing from the printings picker),
  // `chosen` is undefined but `row.scryfallId` still identifies the
  // exact printing. Synthesize an image URL from that id so the
  // deck editor renders the correct art on reload — without this,
  // we'd silently substitute Dexie's newest known printing and the
  // user's choice would appear discarded.
  const imageUri =
    chosen?.imageUri ??
    (row.scryfallId
      ? `https://api.scryfall.com/cards/${encodeURIComponent(row.scryfallId)}?format=image&version=${ScryfallImageSize.Normal}`
      : undefined);

  return {
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    typeLine: lookup.typeLine,
    manaCost: lookup.manaCost,
    cmc: lookup.cmc,
    colors: lookup.colors,
    power: lookup.power,
    toughness: lookup.toughness,
    set: chosen?.set ?? row.set,
    collectorNumber: chosen?.collectorNumber ?? row.collectorNumber,
    scryfallId: chosen?.scryfallId ?? row.scryfallId,
    imageUri,
    lookupSource: lookup.source,
  };
}

function pickPrinting(
  hint: ParsedCard,
  printings: PrintingSummary[],
): PrintingSummary | undefined {
  if (!printings.length) return undefined;

  // Prefer an exact Scryfall id match.
  if (hint.scryfallId) {
    const byId = printings.find((p) => p.scryfallId === hint.scryfallId);
    if (byId) return byId;
    // A scryfallId hint that Dexie can't resolve means the user picked
    // a printing from Scryfall that's not in their imported card DB.
    // Returning undefined preserves the hint values in assembleDeckCard
    // (set/collectorNumber/scryfallId flow through from `row.*`).
    // If we fell through to `printings[last]` here we'd silently
    // replace the user's pick with Dexie's newest — a data-losing bug.
    return undefined;
  }

  // Set-hint fallback: same "don't silently substitute" rule applies.
  if (hint.set) {
    const bySet = printings.find(
      (p) =>
        p.set?.toLowerCase() === hint.set!.toLowerCase() &&
        (!hint.collectorNumber || p.collectorNumber === hint.collectorNumber),
    );
    if (bySet) return bySet;
    return undefined;
  }

  // No hint at all — use newest.
  return printings[printings.length - 1];
}
