import { primaryImageUri, type ImageCandidateSource } from '@app/services';

export function upgradeScryfallImageSize(url: string | undefined): string | undefined {
  if (!url) {
    return url;
  }
  if (url.includes('api.scryfall.com')) {
    return url.replace(/([?&])version=[^&]+/i, '$1version=normal');
  }
  if (url.includes('cards.scryfall.io')) {
    return url.replace(/(cards\.scryfall\.io\/)(small|border_crop|art_crop|png|large)(\/)/i, '$1normal$3');
  }
  return url;
}

export function previewImageUrls(cards: ReadonlyArray<ImageCandidateSource>): string[] {
  return Array.from(
    new Set(
      cards
        .map((card) => upgradeScryfallImageSize(primaryImageUri(card)))
        .filter((u): u is string => !!u),
    ),
  );
}
