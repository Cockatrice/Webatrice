import { ScryfallImageSize } from '@cockatrice/datatrice';

import { cleanScryfallName, scryfallCardUrl, scryfallNamedUrl } from './client';

export const CARD_BACK_URL = 'https://backs.scryfall.io/normal/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg';

export function getScryfallUrlById(
  providerId: string,
  size: ScryfallImageSize = ScryfallImageSize.Small,
): string {
  return `${scryfallCardUrl(providerId)}?format=image&version=${size}`;
}

export function getScryfallUrlByExactName(
  name: string,
  size: ScryfallImageSize = ScryfallImageSize.Small,
): string {
  return `${scryfallNamedUrl(name)}&format=image&version=${size}`;
}

export function getScryfallUrlByName(
  name: string,
  size: ScryfallImageSize = ScryfallImageSize.Small,
): string {
  // See .github/instructions/webatrice.instructions.md#protocol-quirks.
  return getScryfallUrlByExactName(cleanScryfallName(name), size);
}

export function getScryfallUrl(
  card: { providerId?: string; name?: string },
  size: ScryfallImageSize = ScryfallImageSize.Small,
): string | null {
  if (card.providerId) {
    return getScryfallUrlById(card.providerId, size);
  }
  if (card.name) {
    return getScryfallUrlByName(card.name, size);
  }
  return null;
}

export function getScryfallSymbolUrl(symbol: string): string {
  const inner = /^\{[^}]+\}$/.test(symbol) ? symbol.slice(1, -1) : symbol;
  return `https://svgs.scryfall.io/card-symbols/${inner.replace(/\//g, '')}.svg`;
}

export function getScryfallUrlByIdOrExactName(
  card: { scryfallId?: string; name: string },
  size: ScryfallImageSize,
): string {
  return card.scryfallId
    ? getScryfallUrlById(card.scryfallId, size)
    : getScryfallUrlByExactName(card.name, size);
}
