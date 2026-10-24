import { cachePrefix, oldestEntries, routeRequest } from './policy';

const origin = 'https://example.test';
const manifest = { base: '/Webatrice/', publicFiles: ['/Webatrice/locales/en.json', '/Webatrice/env.js'] };
const request = (url: string, overrides: Partial<Request> = {}) => ({
  url: new URL(url, origin).href, method: 'GET', mode: 'cors' as RequestMode,
  destination: '' as RequestDestination, ...overrides,
});

describe('service worker routing', () => {
  it.each([
    ['/Webatrice/assets/boot-AbCd_123.js', 'asset'],
    ['/Webatrice/assets/gu-AbCd_123.svg', 'asset'],
    ['/Webatrice/assets/boot.js', 'network'],
    ['/Webatrice/locales/en.json', 'public'],
    ['/Webatrice/env.js', 'public'],
    ['/Webatrice/api/account', 'network'],
    ['/Webatrice/sw.js', 'network'],
    ['/Webatrice/sw-manifest.json', 'network'],
    ['/assets/boot-AbCd_123.js', 'network'],
    ['/Webatrice-other/index.html', 'network'],
    ['/Webatrice/index.html', 'document'],
    ['/Webatrice/', 'document'],
    ['/Webatrice/?sw-disable', 'network'],
    ['https://api.scryfall.com/cards/random', 'network'],
    ['https://other.test/image.jpg', 'network'],
    ['wss://example.test/Webatrice/socket', 'network'],
  ])('%s uses %s', (url, expected) => {
    expect(routeRequest(request(url), origin, manifest)).toBe(expected);
  });

  it('only caches image requests on the exact Scryfall image origin', () => {
    expect(routeRequest(request('https://cards.scryfall.io/normal/card.jpg', { destination: 'image' }), origin, manifest))
      .toBe('image');
    expect(routeRequest(request('https://cards.scryfall.io/anything.json'), origin, manifest)).toBe('network');
    expect(routeRequest(request('https://cards.scryfall.io.evil.test/card.jpg', { destination: 'image' }), origin, manifest))
      .toBe('network');
  });

  it('bypasses writes and supports scoped navigation and root deployments', () => {
    expect(routeRequest(request('/Webatrice/env.js', { method: 'POST' }), origin, manifest)).toBe('network');
    expect(routeRequest(request('/Webatrice/decks', { mode: 'navigate' }), origin, manifest)).toBe('document');
    expect(routeRequest(request('/assets/boot-AbCd_123.js'), origin, { base: '/', publicFiles: [] })).toBe('asset');
  });

  it('isolates cache namespaces by deployment base', () => {
    expect(cachePrefix('/Webatrice/')).toBe('webatrice:/Webatrice/:');
    expect(cachePrefix('/')).not.toBe(cachePrefix('/Webatrice/'));
  });
});

describe('oldest entry eviction', () => {
  it('retains the newest 1000 entries in insertion order without changing the input', () => {
    const entries = Array.from({ length: 1003 }, (_, index) => index);
    expect(oldestEntries(entries, 1000)).toEqual([0, 1, 2]);
    expect(entries).toHaveLength(1003);
    expect(oldestEntries(entries.slice(0, 1000), 1000)).toEqual([]);
    expect(oldestEntries([], 1000)).toEqual([]);
    expect(oldestEntries([1, 2], 0)).toEqual([1, 2]);
  });
});
