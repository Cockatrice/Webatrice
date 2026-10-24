import {
  LOGIN_ART_CARDS,
  LOGIN_ART_STORAGE_KEY,
  createLoginArt,
  loginArtUrl,
  pickLoginArt,
  readLoginArt,
  writeLoginArt,
} from './loginArt';

beforeEach(() => window.localStorage.clear());

describe('loginArt', () => {
  test('builds a Scryfall art crop URL for the exact card name', () => {
    const url = loginArtUrl('Niv-Mizzet, Parun');
    expect(url).toContain('https://api.scryfall.com/cards/named?exact=Niv-Mizzet%2C%20Parun');
    expect(url).toContain('format=image');
    expect(url).toContain('version=art_crop');
  });

  test('picks from the curated list', () => {
    expect(pickLoginArt(() => 0)).toBe(LOGIN_ART_CARDS[0]);
    expect(pickLoginArt(() => 0.9999)).toBe(LOGIN_ART_CARDS[LOGIN_ART_CARDS.length - 1]);
  });

  test('never repeats the current art when shuffling', () => {
    const current = LOGIN_ART_CARDS[0];
    for (const r of [0, 0.25, 0.5, 0.75, 0.9999]) {
      expect(pickLoginArt(() => r, current)).not.toBe(current);
    }
  });

  test('stays in range when the random source returns 1', () => {
    expect(LOGIN_ART_CARDS).toContain(pickLoginArt(() => 1));
  });

  test('persists the exact URL and attribution and rejects altered records', () => {
    const art = createLoginArt(() => 0);
    writeLoginArt(art);
    expect(readLoginArt()).toEqual(art);

    window.localStorage.setItem(LOGIN_ART_STORAGE_KEY, JSON.stringify({ ...art, url: 'https://example.test/tracker' }));
    expect(readLoginArt()).toBeUndefined();
  });
});
