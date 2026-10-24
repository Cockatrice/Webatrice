import { DEFAULT_PLAYMAT_SETTINGS, PlaymatFallbackBehavior, PlaymatMode, type PlaymatSettings } from '@app/hooks';

import { resolvePlaymat, samePlaymat } from './resolvePlaymat';

const PARAMS = { marginPctL: 0.07, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 };
const mat = (cardName: string) => ({ cardName, cardProviderId: '', params: PARAMS });
const DECK = mat('Deck Mat');
const A = mat('A');
const B = mat('B');
const C = mat('C');

const settings = (patch: Partial<PlaymatSettings>): PlaymatSettings => ({ ...DEFAULT_PLAYMAT_SETTINGS, ...patch });

describe('resolvePlaymat', () => {
  describe('fallback mode', () => {
    it('prefers the deck playmat', () => {
      expect(resolvePlaymat(DECK, settings({ fallbackList: [A] }), 0)).toBe(DECK);
    });

    it('falls back to the collection when the deck has none', () => {
      expect(resolvePlaymat(null, settings({ fallbackList: [A, B] }), 0)).toBe(A);
    });

    it('resolves nothing without a deck playmat or a collection', () => {
      expect(resolvePlaymat(null, settings({}), 0)).toBeNull();
    });
  });

  it('override mode ignores the deck playmat', () => {
    expect(resolvePlaymat(DECK, settings({ mode: PlaymatMode.OVERRIDE_DECK, fallbackList: [A] }), 0)).toBe(A);
    expect(resolvePlaymat(DECK, settings({ mode: PlaymatMode.OVERRIDE_DECK }), 0)).toBeNull();
  });

  it('deck-only mode ignores the collection', () => {
    expect(resolvePlaymat(null, settings({ mode: PlaymatMode.DECK_ONLY, fallbackList: [A] }), 0)).toBeNull();
    expect(resolvePlaymat(DECK, settings({ mode: PlaymatMode.DECK_ONLY, fallbackList: [A] }), 0)).toBe(DECK);
  });

  it('round-robin cycles through the collection by rotation index', () => {
    const roundRobin = settings({ fallbackBehavior: PlaymatFallbackBehavior.ROUND_ROBIN, fallbackList: [A, B, C] });
    expect([0, 1, 2, 3].map((i) => resolvePlaymat(null, roundRobin, i))).toEqual([A, B, C, A]);
  });

  it('random never repeats the previous pick when it has a choice', () => {
    const random = settings({ fallbackBehavior: PlaymatFallbackBehavior.RANDOM, fallbackList: [A, B] });
    expect(resolvePlaymat(null, random, 0, A, () => 0)).toBe(B);
    expect(resolvePlaymat(null, random, 0, B, () => 0.99)).toBe(A);
  });

  it('random keeps a single entry even if it was the previous pick', () => {
    const random = settings({ fallbackBehavior: PlaymatFallbackBehavior.RANDOM, fallbackList: [A] });
    expect(resolvePlaymat(null, random, 0, A, () => 0.5)).toBe(A);
  });
});

describe('samePlaymat', () => {
  it('compares by value', () => {
    expect(samePlaymat(A, mat('A'))).toBe(true);
    expect(samePlaymat(A, { ...A, params: { ...PARAMS, zoom: 2 } })).toBe(false);
    expect(samePlaymat(A, B)).toBe(false);
    expect(samePlaymat(null, null)).toBe(true);
    expect(samePlaymat(A, null)).toBe(false);
  });
});
