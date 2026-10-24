import { avatarDataUri } from './useOwnAvatarUrl';

describe('avatarDataUri', () => {
  it('encodes the avatar bytes as a PNG data URI', () => {
    expect(avatarDataUri(new Uint8Array([137, 80, 78, 71]))).toBe('data:image/png;base64,iVBORw==');
  });

  it('has none without an avatar', () => {
    expect(avatarDataUri(undefined)).toBeNull();
    expect(avatarDataUri(new Uint8Array())).toBeNull();
  });
});
