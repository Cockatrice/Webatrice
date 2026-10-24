import { ServerCapability, parseServerVersion, serverSupports } from './server.capabilities';

describe('parseServerVersion', () => {
  it.each([
    ['3.0.0 (2026-05-08)', { major: 3, minor: 0, patch: 0, prerelease: [] }],
    ['3.1.0-beta.15 (2026-09-27)', { major: 3, minor: 1, patch: 0, prerelease: ['beta', 15] }],
    ['3.1.0-beta (2026-06-26)', { major: 3, minor: 1, patch: 0, prerelease: ['beta'] }],
    ['3.1.0 ()', { major: 3, minor: 1, patch: 0, prerelease: [] }],
    ['  2.10.3', { major: 2, minor: 10, patch: 3, prerelease: [] }],
  ])('parses %j', (input, expected) => {
    expect(parseServerVersion(input)).toEqual(expected);
  });

  it.each([null, undefined, '', 'unknown', 'v3.1.0', '3.1'])('returns null for %j', (input) => {
    expect(parseServerVersion(input)).toBeNull();
  });
});

describe('serverSupports', () => {
  it.each([
    ['3.1.0-1', false],
    ['3.1.0-alpha', false],
    ['3.1.0-rc', true],
    ['3.1.0-beta.preview', true],
    ['3.1.0-beta.8', true],
  ])('orders mixed prerelease identifiers in %s against the reports minimum', (raw, expected) => {
    expect(serverSupports(raw, ServerCapability.REPORTS)).toBe(expected);
  });
  const capabilities = Object.values(ServerCapability);
  const beta = (n: number) => `3.1.0-beta.${n} (2026-09-01)`;

  it.each(capabilities)('%s is unavailable on a 3.0.0 server', (capability) => {
    expect(serverSupports('3.0.0 (2026-05-08)', capability)).toBe(false);
  });

  it('offers nothing on the first 3.1 beta', () => {
    for (const capability of capabilities) {
      expect(serverSupports('3.1.0-beta (2026-06-26)', capability)).toBe(false);
    }
  });

  it('beta.7 has card art but not the beta.8 features', () => {
    expect(serverSupports(beta(7), ServerCapability.CARD_ART)).toBe(true);
    expect(serverSupports(beta(7), ServerCapability.REPORTS)).toBe(false);
    expect(serverSupports(beta(7), ServerCapability.MODERATION_TOOLS)).toBe(false);
    expect(serverSupports(beta(7), ServerCapability.PLAYMATS)).toBe(false);
  });

  it('beta.11 has reports, moderation tools and playmats but no developer role', () => {
    expect(serverSupports(beta(11), ServerCapability.REPORTS)).toBe(true);
    expect(serverSupports(beta(11), ServerCapability.MODERATION_TOOLS)).toBe(true);
    expect(serverSupports(beta(11), ServerCapability.PLAYMATS)).toBe(true);
    expect(serverSupports(beta(11), ServerCapability.DEVELOPER_ROLE)).toBe(false);
    expect(serverSupports(beta(11), ServerCapability.DECK_SHARING)).toBe(false);
  });

  it('beta.12 adds the developer role but not deck sharing', () => {
    expect(serverSupports(beta(12), ServerCapability.DEVELOPER_ROLE)).toBe(true);
    expect(serverSupports(beta(12), ServerCapability.DECK_SHARING)).toBe(false);
  });

  it.each(capabilities)('%s is available on beta.15', (capability) => {
    expect(serverSupports(beta(15), capability)).toBe(true);
  });

  it.each(capabilities)('%s is available on the 3.1.0 release, which outranks every beta', (capability) => {
    expect(serverSupports('3.1.0 (2026-11-01)', capability)).toBe(true);
  });

  it('compares beta numbers numerically', () => {
    expect(serverSupports(beta(2), ServerCapability.CARD_ART)).toBe(true);
    expect(serverSupports(beta(13), ServerCapability.DECK_SHARING)).toBe(true);
    expect(serverSupports(beta(1), ServerCapability.CARD_ART)).toBe(false);
  });

  it('treats later releases as supporting 3.1 capabilities', () => {
    expect(serverSupports('3.2.0 (2027-01-01)', ServerCapability.REPORTS)).toBe(true);
    expect(serverSupports('3.2.0-beta (2027-01-01)', ServerCapability.DECK_SHARING)).toBe(true);
    expect(serverSupports('4.0.0', ServerCapability.DECK_SHARING)).toBe(true);
    expect(serverSupports('3.1.1', ServerCapability.PLAYMATS)).toBe(true);
  });

  it('treats older releases as not supporting them', () => {
    expect(serverSupports('2.99.99', ServerCapability.REPORTS)).toBe(false);
  });

  it('answers false for an unknown version', () => {
    expect(serverSupports(null, ServerCapability.REPORTS)).toBe(false);
    expect(serverSupports('custom-build', ServerCapability.REPORTS)).toBe(false);
  });
});
