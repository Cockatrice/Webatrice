import { previewImageUrls, upgradeScryfallImageSize } from './scryfallImage';

describe('upgradeScryfallImageSize', () => {
  it('rewrites the API version parameter to normal', () => {
    expect(upgradeScryfallImageSize('https://api.scryfall.com/cards/abc?format=image&version=small'))
      .toBe('https://api.scryfall.com/cards/abc?format=image&version=normal');
  });

  it('rewrites the CDN size path segment to normal', () => {
    expect(upgradeScryfallImageSize('https://cards.scryfall.io/small/front/a/b.jpg'))
      .toBe('https://cards.scryfall.io/normal/front/a/b.jpg');
    expect(upgradeScryfallImageSize('https://cards.scryfall.io/art_crop/front/a/b.jpg'))
      .toBe('https://cards.scryfall.io/normal/front/a/b.jpg');
  });

  it('passes other URLs and empty values through', () => {
    expect(upgradeScryfallImageSize('https://example.com/card.png')).toBe('https://example.com/card.png');
    expect(upgradeScryfallImageSize(undefined)).toBeUndefined();
  });
});

describe('previewImageUrls', () => {
  it('returns the distinct normalized URLs, skipping cards without art', () => {
    expect(previewImageUrls([
      { imageUri: 'https://cards.scryfall.io/small/front/a.jpg' },
      { imageUri: 'https://cards.scryfall.io/large/front/a.jpg' },
      {},
    ])).toEqual(['https://cards.scryfall.io/normal/front/a.jpg']);
  });
});
