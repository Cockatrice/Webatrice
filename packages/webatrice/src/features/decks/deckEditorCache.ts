import { onSessionEnd } from '@app/services/session';
import { setUnloadRisk } from '../../services/unloadGuard';

import type { HydratedDeck } from './types';

export interface CachedDeck {
  deck: HydratedDeck;
  savedSignature: string | null;
}

const deckCache: Map<number, CachedDeck> = new Map();

export function getCachedDeck(deckId: number): CachedDeck | undefined {
  return deckCache.get(deckId);
}

export function setCachedDeck(deckId: number, entry: CachedDeck): void {
  deckCache.set(deckId, entry);
}

export function clearDeckEditorCache(): void {
  deckCache.clear();
}
onSessionEnd(clearDeckEditorCache);

export function retainCachedDecks(keep: (deckId: number, entry: CachedDeck) => boolean): void {
  for (const [deckId, entry] of deckCache) {
    if (!keep(deckId, entry)) {
      deckCache.delete(deckId);
    }
  }
}

export function deleteCachedDeck(deckId: number): void {
  deckCache.delete(deckId);
}

const draftDocuments: Map<string, string> = new Map();
const draftCache: Map<string, HydratedDeck> = new Map();
const draftUnloadRisk = {};
const draftHasWork = (deck: HydratedDeck) => Boolean(
  deck.name.trim()
  || deck.cards.length
  || deck.format.trim()
  || deck.meta.description?.trim()
  || deck.meta.commanders?.length
  || deck.bannerCard
  || deck.bannerCardProviderId
  || deck.playmatXml
  || deck.sideboardPlansXml?.length
  || deck.extraZonesXml?.length
  || deck.tagsXml
  || deck.bracketAssessment,
);
const syncDraftUnloadRisk = () => setUnloadRisk(draftUnloadRisk, [...draftCache.values()].some(draftHasWork));
onSessionEnd(() => {
  draftDocuments.clear();
  draftCache.clear();
  syncDraftUnloadRisk();
});

export function getDraftDocument(token: string): string | undefined {
  return draftDocuments.get(token);
}

const MAX_DRAFTS = 4;

export function setDraftDocument(token: string, cod: string): void {
  draftDocuments.set(token, cod);
  for (const oldest of draftDocuments.keys()) {
    if (draftDocuments.size <= MAX_DRAFTS) {
      break;
    }
    draftDocuments.delete(oldest);
    draftCache.delete(oldest);
    syncDraftUnloadRisk();
  }
}

export function getCachedDraft(token: string): HydratedDeck | undefined {
  return draftCache.get(token);
}

export function setCachedDraft(token: string, deck: HydratedDeck): void {
  draftCache.set(token, deck);
  syncDraftUnloadRisk();
}

export function deleteCachedDraft(token: string): void {
  draftCache.delete(token);
  syncDraftUnloadRisk();
}

export function deleteDraft(token: string): void {
  draftDocuments.delete(token);
  draftCache.delete(token);
  syncDraftUnloadRisk();
}
