import { ScryfallImageSize } from '@cockatrice/datatrice';
import { getScryfallUrl, getScryfallUrlById, getScryfallUrlByName } from '@app/services';

const SCRYFALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isScryfallId(id: string | undefined): id is string {
  return !!id && SCRYFALL_ID.test(id);
}

export function playmatArtCropUrls(cardName: string, printingIds: readonly (string | undefined)[]): string[] {
  const id = printingIds.find(isScryfallId);
  const name = cardName.trim();
  return [
    ...(id ? [getScryfallUrlById(id, ScryfallImageSize.ArtCrop)] : []),
    ...(name ? [getScryfallUrlByName(name, ScryfallImageSize.ArtCrop)] : []),
  ];
}

export function playmatFullImageUrls(
  candidates: readonly string[], cardName: string, cardProviderId: string, providerPrintingKnown: boolean,
): string[] {
  if (!candidates.length || !cardProviderId || providerPrintingKnown) {
    return [...candidates];
  }
  const providerUrl = getScryfallUrl({ providerId: cardProviderId, name: cardName }, ScryfallImageSize.Large);
  return [...candidates.slice(0, -1), providerUrl, ...candidates.slice(-1)].filter((url): url is string => !!url);
}

export interface PlaymatImageSources {
  urls: string[];
  artCrops: ReadonlySet<string>;
}

export function playmatImageSources(artCrops: readonly string[], fullImages: readonly string[]): PlaymatImageSources {
  if (!fullImages.length) {
    return { urls: [], artCrops: new Set() };
  }
  return { urls: [...new Set([...artCrops, ...fullImages])], artCrops: new Set(artCrops) };
}
