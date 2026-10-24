import type { games } from '@cockatrice/datatrice';
import { readDeckPlaymat, writeDeckPlaymat } from '@app/services';
import type { BracketAssessment, DeckCategory } from '@app/types';
import { imageCandidatesOf, primaryImageUri } from '@app/services';

import { readDeckTags, writeDeckTags, type BannerCandidate } from './deckTags';
import type { DeckCard, HydratedDeck } from './types';

export function renameDeck(deck: HydratedDeck, name: string): HydratedDeck {
  return deck.name === name ? deck : { ...deck, name };
}

export function setDeckFormat(deck: HydratedDeck, format: string): HydratedDeck {
  return deck.format === format ? deck : { ...deck, format };
}

export function setDeckDescription(deck: HydratedDeck, description: string): HydratedDeck {
  const next = description || undefined;
  return deck.meta.description === next ? deck : { ...deck, meta: { ...deck.meta, description: next } };
}

export function setDeckBanner(deck: HydratedDeck, banner: BannerCandidate | null): HydratedDeck {
  const name = banner?.name || undefined;
  const providerId = (name && banner?.providerId) || undefined;
  if (deck.bannerCard === name && deck.bannerCardProviderId === providerId) {
    return deck;
  }
  return { ...deck, bannerCard: name, bannerCardProviderId: providerId };
}

export function setDeckTags(deck: HydratedDeck, tags: readonly string[]): HydratedDeck {
  const current = readDeckTags(deck.tagsXml);
  if (current.length === tags.length && current.every((tag, i) => tag === tags[i])) {
    return deck;
  }
  return { ...deck, tagsXml: writeDeckTags(deck.tagsXml, tags) };
}

export function setDeckPlaymat(deck: HydratedDeck, playmat: games.Playmat | null): HydratedDeck {
  const playmatXml = writeDeckPlaymat(playmat);
  if (writeDeckPlaymat(readDeckPlaymat(deck.playmatXml)) === playmatXml) {
    return deck;
  }
  return { ...deck, playmatXml };
}

export function setDeckPriceCache(
  deck: HydratedDeck,
  priceUsd: number | undefined,
  priceMissingCount: number | undefined,
): HydratedDeck {
  if (deck.meta.priceUsd === priceUsd && deck.meta.priceMissingCount === priceMissingCount) {
    return deck;
  }
  return { ...deck, meta: { ...deck.meta, priceUsd, priceMissingCount } };
}

export function setDeckBracketAssessment(
  deck: HydratedDeck,
  assessment: BracketAssessment | undefined,
): HydratedDeck {
  if (
    deck.meta.bracketLevel === assessment?.level
    && deck.bracketAssessment?.fingerprint === assessment?.fingerprint
  ) {
    return deck;
  }
  return {
    ...deck,
    meta: { ...deck.meta, bracketLevel: assessment?.level },
    bracketAssessment: assessment,
  };
}

function withCards(deck: HydratedDeck, edit: (cards: DeckCard[]) => void): HydratedDeck {
  const cards = deck.cards.slice();
  edit(cards);
  return { ...deck, cards };
}

export function patchCard(deck: HydratedDeck, index: number, patch: Partial<DeckCard>): HydratedDeck {
  return withCards(deck, (cards) => {
    cards[index] = { ...cards[index], ...patch };
  });
}

export function rowIdentity(card: DeckCard): string {
  return JSON.stringify([card.category, card.name.toLowerCase(), card.scryfallId ?? '', card.zonePath ?? []]);
}

function mergeIntoTwin(deck: HydratedDeck, index: number): HydratedDeck {
  const row = deck.cards[index];
  const identity = rowIdentity(row);
  const twin = deck.cards.findIndex((c, i) => i !== index && rowIdentity(c) === identity);
  if (twin < 0) {
    return deck;
  }
  return withCards(deck, (cards) => {
    cards[twin] = {
      ...cards[twin],
      quantity: cards[twin].quantity + row.quantity,
      ...(row.isCommander ? { isCommander: true } : {}),
    };
    cards.splice(index, 1);
  });
}

export function mergeDuplicateRows(cards: readonly DeckCard[]): DeckCard[] {
  const merged: DeckCard[] = [];
  const at = new Map<string, number>();
  for (const card of cards) {
    const identity = rowIdentity(card);
    const twin = at.get(identity);
    if (twin == null) {
      at.set(identity, merged.length);
      merged.push(card);
    } else {
      merged[twin] = {
        ...merged[twin],
        quantity: merged[twin].quantity + card.quantity,
        ...(card.isCommander ? { isCommander: true } : {}),
      };
    }
  }
  return merged.length === cards.length ? [...cards] : merged;
}

export function removeCard(deck: HydratedDeck, index: number): HydratedDeck {
  return withCards(deck, (cards) => {
    cards.splice(index, 1);
  });
}

export function adjustCardQuantity(deck: HydratedDeck, index: number, delta: number): HydratedDeck {
  return withCards(deck, (cards) => {
    const nextQty = cards[index].quantity + delta;
    if (nextQty <= 0) {
      cards.splice(index, 1);
    } else {
      cards[index] = { ...cards[index], quantity: nextQty };
    }
  });
}

export function setCardCategory(deck: HydratedDeck, index: number, category: DeckCategory): HydratedDeck {
  return deck.cards[index]?.category === category ? deck : mergeIntoTwin(patchCard(deck, index, { category }), index);
}

export interface CardPrinting {
  set?: string;
  collectorNumber?: string;
  scryfallId?: string;
  imageUri?: string;
  imageUris?: string[];
}

export function setCardPrinting(deck: HydratedDeck, index: number, printing: CardPrinting): HydratedDeck {
  const card = deck.cards[index];
  const imageUris = imageCandidatesOf(printing);
  const currentImageUris = imageCandidatesOf(card);
  const sameImages = imageUris.length === 0
    || (imageUris.length === currentImageUris.length && imageUris.every((url, i) => url === currentImageUris[i]));
  if (
    !card
    || (card.set === printing.set
      && card.collectorNumber === printing.collectorNumber
      && card.scryfallId === printing.scryfallId
      && sameImages)
  ) {
    return deck;
  }
  return mergeIntoTwin(patchCard(deck, index, {
    set: printing.set,
    collectorNumber: printing.collectorNumber,
    scryfallId: printing.scryfallId,
    imageUri: primaryImageUri({ imageUris }),
    imageUris,
  }), index);
}

export function setCardCommander(deck: HydratedDeck, index: number, isCommander: boolean): HydratedDeck {
  const current = deck.cards[index];
  if (!current || (current.isCommander === true) === isCommander) {
    return deck;
  }
  return patchCard(deck, index, {
    isCommander,
    quantity: isCommander ? 1 : current.quantity,
  });
}

export function appendCard(deck: HydratedDeck, card: DeckCard): HydratedDeck {
  return { ...deck, cards: [...deck.cards, card] };
}

export function normalizeAddedCardName(name: string): string {
  return name.trim().split(' // ')[0].trim();
}

export function findMainboardRow(deck: HydratedDeck, name: string): number {
  const lower = name.toLowerCase();
  return deck.cards.findIndex((c) => c.category === 'main' && c.name.toLowerCase() === lower);
}
