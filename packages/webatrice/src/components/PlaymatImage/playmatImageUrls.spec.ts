import { isScryfallId, playmatArtCropUrls, playmatFullImageUrls, playmatImageSources } from './playmatImageUrls';

const HOOF = '276f5cee-a501-4658-bd4d-7a044bf1ccbc';
const OTHER = '8fed056f-a8f5-41ec-a7d2-a80a238872d1';

describe('isScryfallId', () => {
  it('accepts Scryfall UUIDs only', () => {
    expect(isScryfallId(HOOF)).toBe(true);
    expect(isScryfallId('preferred')).toBe(false);
    expect(isScryfallId('')).toBe(false);
    expect(isScryfallId(undefined)).toBe(false);
  });
});

describe('playmatArtCropUrls', () => {
  it('asks Scryfall for the art crop of the first known printing, then by name', () => {
    expect(playmatArtCropUrls('Craterhoof Behemoth', ['', 'custom-uuid', HOOF, OTHER])).toEqual([
      `https://api.scryfall.com/cards/${HOOF}?format=image&version=art_crop`,
      'https://api.scryfall.com/cards/named?exact=Craterhoof%20Behemoth&format=image&version=art_crop',
    ]);
  });

  it('falls back to the name when no printing has a Scryfall id', () => {
    expect(playmatArtCropUrls(' Island ', ['custom-uuid', undefined])).toEqual([
      'https://api.scryfall.com/cards/named?exact=Island&format=image&version=art_crop',
    ]);
  });

  it('has nothing to ask for without a name or id', () => {
    expect(playmatArtCropUrls('  ', [undefined])).toEqual([]);
  });
});

describe('playmatFullImageUrls', () => {
  const candidates = ['https://images.test/a.jpg', 'https://scryfall.test/named-large'];

  it('keeps the candidates when the announced printing is in the card database', () => {
    expect(playmatFullImageUrls(candidates, 'Island', HOOF, true)).toEqual(candidates);
  });

  it('tries an unknown announced printing before the name fallback', () => {
    expect(playmatFullImageUrls(candidates, 'Island', HOOF, false)).toEqual([
      'https://images.test/a.jpg',
      `https://api.scryfall.com/cards/${HOOF}?format=image&version=large`,
      'https://scryfall.test/named-large',
    ]);
  });

  it('waits for the candidates', () => {
    expect(playmatFullImageUrls([], 'Island', HOOF, false)).toEqual([]);
  });
});

describe('playmatImageSources', () => {
  it('puts art crops before the full images and remembers which are art crops', () => {
    const sources = playmatImageSources(['art', 'shared'], ['full', 'shared']);
    expect(sources.urls).toEqual(['art', 'shared', 'full']);
    expect([...sources.artCrops]).toEqual(['art', 'shared']);
  });

  it('loads nothing until the card lookup has produced the full-image candidates', () => {
    expect(playmatImageSources(['art'], [])).toEqual({ urls: [], artCrops: new Set() });
  });
});
