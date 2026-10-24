import { act, renderHook, waitFor } from '@testing-library/react';

import type { BracketAssessment } from '@app/types';

import { analyzeBracket, deckFingerprint, type BracketAnalysis } from '../bracket';
import type { DeckCard } from '../types';
import { useBracketAssessment } from './useBracketAssessment';

vi.mock('../bracket', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../bracket')>()),
  analyzeBracket: vi.fn(),
}));

const cards: DeckCard[] = [{ name: 'Sol Ring', quantity: 1, category: 'main', lookupSource: 'scryfall' }];

const signals = {
  turns: { matches: [], restricted: [] },
  denial: { matches: [], restricted: [] },
  gameChangers: { matches: [] },
  earlyCombos: [],
  lateCombos: [],
};
const complete: BracketAnalysis = { report: { level: 1, signals }, unavailable: [] };
const degraded: BracketAnalysis = {
  report: { level: 2, signals },
  unavailable: [{ source: 'combos', failure: { kind: 'timeout' } }],
};

describe('useBracketAssessment', () => {
  it('uses a cached assessment that still matches the deck without analysing or persisting', () => {
    const cached: BracketAssessment = {
      level: 4, fingerprint: deckFingerprint(cards), gameChangers: [], turns: [], turnsRestricted: [],
      denial: [], denialRestricted: [], earlyCombos: [], lateCombos: [],
    };
    const persist = vi.fn();
    const { result } = renderHook(() => useBracketAssessment(cards, cached, persist, true));

    expect(result.current).toEqual(expect.objectContaining({ status: 'complete' }));
    expect(result.current.status === 'complete' && result.current.report.level).toBe(4);
    expect(analyzeBracket).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('re-analyses when a card moves to the sideboard, instead of serving the cached assessment', async () => {
    const cached: BracketAssessment = {
      level: 4, fingerprint: deckFingerprint(cards), gameChangers: [], turns: [], turnsRestricted: [],
      denial: [], denialRestricted: [], earlyCombos: [], lateCombos: [],
    };
    vi.mocked(analyzeBracket).mockResolvedValue(complete);
    const moved: DeckCard[] = [{ ...cards[0], category: 'sideboard' }];
    const { result } = renderHook(() => useBracketAssessment(moved, cached, vi.fn(), true));

    await waitFor(() => expect(result.current.status === 'complete' && result.current.report.level).toBe(1));
    expect(analyzeBracket).toHaveBeenCalledWith(moved);
  });

  it('persists a complete analysis with the deck fingerprint', async () => {
    vi.mocked(analyzeBracket).mockResolvedValue(complete);
    const persist = vi.fn();
    const { result } = renderHook(() => useBracketAssessment(cards, undefined, persist, true));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ level: 1, fingerprint: deckFingerprint(cards) }));
  });

  it('reports a degraded analysis without persisting it, and retries on demand', async () => {
    vi.mocked(analyzeBracket).mockResolvedValue(degraded);
    const persist = vi.fn();
    const { result } = renderHook(() => useBracketAssessment(cards, undefined, persist, true));

    await waitFor(() => expect(result.current.status).toBe('degraded'));
    expect(result.current).toEqual(expect.objectContaining({ unavailable: degraded.unavailable }));
    expect(persist).toHaveBeenCalledWith(undefined);
    expect(persist).not.toHaveBeenCalledWith(expect.objectContaining({ level: 2 }));

    vi.mocked(analyzeBracket).mockResolvedValue(complete);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('complete'));
    expect(analyzeBracket).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ level: 1 }));
  });

  it('reports an unexpected failure and clears the persisted assessment', async () => {
    vi.mocked(analyzeBracket).mockRejectedValue(new Error('boom'));
    const persist = vi.fn();
    const { result } = renderHook(() => useBracketAssessment(cards, undefined, persist, true));

    await waitFor(() => expect(result.current).toEqual(expect.objectContaining({ status: 'error', message: 'boom' })));
    expect(persist).toHaveBeenCalledWith(undefined);
  });

  it('leaves the message empty for a failure without one, for the UI to word', async () => {
    vi.mocked(analyzeBracket).mockRejectedValue('boom');
    const { result } = renderHook(() => useBracketAssessment(cards, undefined, undefined, true));

    await waitFor(() => expect(result.current).toEqual(expect.objectContaining({ status: 'error', message: '' })));
  });

  describe('without consent for the third-party lookups', () => {
    const cachedFor = (deck: DeckCard[]): BracketAssessment => ({
      level: 3, fingerprint: deckFingerprint(deck), gameChangers: [], turns: [], turnsRestricted: [],
      denial: [], denialRestricted: [], earlyCombos: [], lateCombos: [],
    });

    it('asks for consent and makes no request', () => {
      const persist = vi.fn();
      const { result } = renderHook(() => useBracketAssessment(cards, undefined, persist, false));

      expect(result.current.status).toBe('consentRequired');
      expect(analyzeBracket).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
    });

    it('still shows a cached assessment that matches the deck', () => {
      const { result } = renderHook(() => useBracketAssessment(cards, cachedFor(cards), vi.fn(), false));

      expect(result.current.status === 'complete' && result.current.report.level).toBe(3);
      expect(analyzeBracket).not.toHaveBeenCalled();
    });

    it('clears a cached assessment for an older version of the deck', () => {
      const older = cachedFor([{ ...cards[0], quantity: 2 }]);
      const persist = vi.fn();
      const { result } = renderHook(() => useBracketAssessment(cards, older, persist, false));

      expect(result.current.status).toBe('consentRequired');
      expect(persist).toHaveBeenCalledWith(undefined);
      expect(analyzeBracket).not.toHaveBeenCalled();
    });

    it('analyses once consent is given', async () => {
      vi.mocked(analyzeBracket).mockResolvedValue(complete);
      const { result, rerender } = renderHook(
        ({ allowed }) => useBracketAssessment(cards, undefined, vi.fn(), allowed),
        { initialProps: { allowed: false } },
      );
      expect(result.current.status).toBe('consentRequired');

      rerender({ allowed: true });
      await waitFor(() => expect(result.current.status).toBe('complete'));
      expect(analyzeBracket).toHaveBeenCalledTimes(1);
    });
  });
});
