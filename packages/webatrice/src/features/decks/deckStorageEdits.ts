import { parseCod } from '@app/services';
import type { ParsedDeck } from '@app/types';

import { readDeckTags, type BannerCandidate } from './deckTags';
import type { HydratedDeck } from './types';

export type DeckStorageEditKind = 'rename' | 'tags' | 'banner';
export type DeckStorageEdit = { banner: BannerCandidate | null } | { tags: readonly string[] } | { name: string };

export function storageEditKind(edit: DeckStorageEdit): DeckStorageEditKind {
  return 'name' in edit ? 'rename' : 'tags' in edit ? 'tags' : 'banner';
}

export function storageEditDraft(
  kind: DeckStorageEditKind, deck: HydratedDeck, fallbackName: string, failedEdit?: DeckStorageEdit | null,
): DeckStorageEdit {
  if (failedEdit && storageEditKind(failedEdit) === kind) {
    return failedEdit;
  }
  if (kind === 'rename') {
    return { name: deck.name || fallbackName };
  }
  if (kind === 'tags') {
    return { tags: readDeckTags(deck.tagsXml) };
  }
  return { banner: deck.bannerCard ? { name: deck.bannerCard, providerId: deck.bannerCardProviderId } : null };
}

function cardsSignature(deck: ParsedDeck): string {
  return JSON.stringify([deck.cards.map((c) => [
    c.name, c.quantity, c.category, c.isCommander === true, c.set ?? '', c.collectorNumber ?? '', c.scryfallId ?? '',
    c.zonePath ?? [],
  ]), deck.extraZonesXml ?? []]);
}

function editedField(deck: ParsedDeck, edit: DeckStorageEdit): string {
  if ('banner' in edit) {
    return JSON.stringify([deck.bannerCard ?? '', deck.bannerCardProviderId ?? '']);
  }
  if ('tags' in edit) {
    return JSON.stringify(readDeckTags(deck.tagsXml));
  }
  return deck.name;
}

export function storageEditConflict(loadedXml: string, freshXml: string, edit: DeckStorageEdit): boolean {
  if (loadedXml === freshXml) {
    return false;
  }
  const loaded = parseCod(loadedXml);
  const fresh = parseCod(freshXml);
  return cardsSignature(loaded) !== cardsSignature(fresh) || editedField(loaded, edit) !== editedField(fresh, edit);
}
