import { ScryfallImageSize } from '@cockatrice/datatrice';

import {
  getScryfallUrlById,
  imageCandidatesOf,
  lookupCardsForHydration,
  printingKey,
  parseCod,
  preferredPrinting,
  primaryImageUri,
  type LookupResult,
  type PrintingSummary,
} from '@app/services';
import type { ParsedCard, ParsedDeck } from '@app/types';

import { mergeDuplicateRows } from './deckEdits';
import { inferDeckFormat } from './decklistParser';
import type { DeckCard, HydratedDeck } from './types';

export type DeckCardDataRefresh = ReadonlyArray<{ card: DeckCard; lookup: LookupResult }>;

export async function hydrateDeck(
  parsed: ParsedDeck,
  signal?: AbortSignal,
  receiveRefresh?: (refresh: Promise<DeckCardDataRefresh>) => void,
): Promise<HydratedDeck> {
  const local = await lookupCardsForHydration(parsed.cards.map(({ name, set, collectorNumber, scryfallId }) => (
    { name, set, collectorNumber, scryfallId }
  )), signal);
  const lookups = local.lookups;

  const cards: DeckCard[] = mergeDuplicateRows(parsed.cards.map((row) => {
    const lookup = lookups.get(printingKey(row));
    return assembleDeckCard(row, lookup);
  }));

  if (receiveRefresh) {
    receiveRefresh(local.refreshed.then((refreshed) => parsed.cards.flatMap((row) => {
      const lookup = refreshed.get(printingKey(row));
      const card = assembleDeckCard(row, lookups.get(printingKey(row)));
      return lookup ? [{ card, lookup }] : [];
    })));
  }

  return {
    name: parsed.name,
    meta: parsed.meta,
    cards,
    format: parsed.format?.trim() || inferDeckFormat(parsed.cards),
    bannerCard: parsed.bannerCard,
    bannerCardProviderId: parsed.bannerCardProviderId,
    lastLoadedTimestamp: parsed.lastLoadedTimestamp,
    playmatXml: parsed.playmatXml,
    sideboardPlansXml: parsed.sideboardPlansXml,
    extraZonesXml: parsed.extraZonesXml,
    tagsXml: parsed.tagsXml,
    bracketAssessment: parsed.bracketAssessment,
  };
}

/** Convenience: fetch → parse → hydrate in one call. */
export async function loadDeckFromCod(xml: string, signal?: AbortSignal): Promise<HydratedDeck> {
  return hydrateDeck(parseCod(xml), signal);
}

export function assembleDeckCard(
  row: ParsedCard,
  lookup: LookupResult | undefined,
): DeckCard {
  if (!lookup || !lookup.found) {
    return {
      name: row.name,
      quantity: row.quantity,
      category: row.category,
      ...(row.isCommander ? { isCommander: true } : {}),
      set: row.set,
      collectorNumber: row.collectorNumber,
      scryfallId: row.scryfallId,
      ...(row.zonePath ? { zonePath: row.zonePath } : {}),
      lookupSource: 'unknown',
    };
  }

  const chosen = pickPrinting(row, lookup);

  const fallbackImageUri = row.scryfallId
    ? getScryfallUrlById(row.scryfallId, ScryfallImageSize.Normal)
    : undefined;
  const imageUris = imageCandidatesOf({ imageUris: imageCandidatesOf(chosen), imageUri: fallbackImageUri });

  return {
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    ...(row.isCommander ? { isCommander: true } : {}),
    typeLine: lookup.typeLine,
    manaCost: lookup.manaCost,
    cmc: lookup.cmc,
    colors: lookup.colors,
    colorIdentity: lookup.colorIdentity,
    power: lookup.power,
    toughness: lookup.toughness,
    set: row.set ?? chosen?.set,
    collectorNumber: row.collectorNumber ?? chosen?.collectorNumber,
    scryfallId: row.scryfallId ?? chosen?.scryfallId,
    imageUri: primaryImageUri({ imageUris }),
    imageUris,
    ...(row.zonePath ? { zonePath: row.zonePath } : {}),
    lookupSource: lookup.source,
  };
}

function pickPrinting(
  hint: ParsedCard,
  lookup: Pick<LookupResult, 'printings' | 'pinnedPrintingId'>,
): PrintingSummary | undefined {
  const { printings } = lookup;
  if (!printings.length) {
    return undefined;
  }

  // Prefer an exact Scryfall id match.
  if (hint.scryfallId) {
    const byId = printings.find((p) => p.scryfallId === hint.scryfallId);
    if (byId) {
      return byId;
    }
    // A scryfallId hint that Dexie can't resolve means the user picked
    // a printing from Scryfall that's not in their imported card DB.
    // Returning undefined preserves the hint values in assembleDeckCard
    // (set/collectorNumber/scryfallId flow through from `row.*`).
    return undefined;
  }

  // Set-hint fallback: same "don't silently substitute" rule applies.
  if (hint.set) {
    const bySet = printings.find(
      (p) =>
        p.set?.toLowerCase() === hint.set!.toLowerCase() &&
        (!hint.collectorNumber || p.collectorNumber === hint.collectorNumber),
    );
    if (bySet) {
      return bySet;
    }
    return undefined;
  }

  if (hint.collectorNumber) {
    return printings.find((p) => p.collectorNumber === hint.collectorNumber);
  }

  return preferredPrinting(lookup);
}

export function applyDeckCardDataRefresh(deck: HydratedDeck, refresh: DeckCardDataRefresh): HydratedDeck {
  const byIdentity = new Map(refresh.map(({ card, lookup }) => [printingKey(card), lookup]));
  let changed = false;
  const cards = deck.cards.map((card) => {
    const lookup = byIdentity.get(printingKey(card));
    if (!lookup) {
      return card;
    }
    const next = assembleDeckCard(card, lookup);
    const keepsSavedPrinting = Boolean(card.scryfallId || card.set || card.collectorNumber);
    const patched: DeckCard = {
      ...card,
      typeLine: next.typeLine,
      manaCost: next.manaCost,
      cmc: next.cmc,
      colors: next.colors,
      colorIdentity: next.colorIdentity,
      power: next.power,
      toughness: next.toughness,
      imageUri: next.imageUri ?? card.imageUri,
      imageUris: next.imageUris?.length ? next.imageUris : card.imageUris,
      set: keepsSavedPrinting ? card.set : next.set,
      collectorNumber: keepsSavedPrinting ? card.collectorNumber : next.collectorNumber,
      scryfallId: keepsSavedPrinting ? card.scryfallId : next.scryfallId,
      lookupSource: next.lookupSource,
    };
    if (JSON.stringify(card) === JSON.stringify(patched)) {
      return card;
    }
    changed = true;
    return patched;
  });
  return changed ? { ...deck, cards } : deck;
}
