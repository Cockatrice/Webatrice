import { ScryfallImageSize } from '@cockatrice/datatrice';
const SCRYFALL_API = 'https://api.scryfall.com';

export function getScryfallUrlById(
  providerId: string,
  size: ScryfallImageSize = ScryfallImageSize.Small,
): string {
  const id = encodeURIComponent(providerId);
  return `${SCRYFALL_API}/cards/${id}?format=image&version=${size}`;
}

export function getScryfallUrlByName(
  name: string,
  size: ScryfallImageSize = ScryfallImageSize.Small,
): string {
  // See .github/instructions/webatrice.instructions.md#protocol-quirks.
  const cleaned = name.replace(/\s*\(?\bToken\b\)?\s*$/i, '');
  const exact = encodeURIComponent(cleaned);
  return `${SCRYFALL_API}/cards/named?exact=${exact}&format=image&version=${size}`;
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
