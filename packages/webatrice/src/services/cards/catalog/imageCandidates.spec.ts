import { imageCandidatesOf, primaryImageUri } from './imageCandidates';

describe('catalogue image candidates', () => {
  it('uses the ordered chain as truth and retains a distinct legacy URL as the final fallback', () => {
    const source = { imageUri: 'legacy', imageUris: ['preferred', 'fallback', 'preferred'] };

    expect(imageCandidatesOf(source)).toEqual(['preferred', 'fallback', 'legacy']);
    expect(primaryImageUri(source)).toBe('preferred');
  });

  it('normalizes a legacy single URL and an empty source', () => {
    expect(imageCandidatesOf({ imageUri: 'legacy' })).toEqual(['legacy']);
    expect(primaryImageUri(undefined)).toBeUndefined();
  });
});
