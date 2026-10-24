import { renderHook } from '@testing-library/react';



import type { BracketAssessment } from '@app/types';



import { deckFingerprint } from '../bracket';

import type { DeckCard } from '../types';

import { useBracketCache } from './useBracketCache';



const cards: DeckCard[] = [{ name: 'Sol Ring', quantity: 1, category: 'main', lookupSource: 'scryfall' }];



function assessment(fingerprint: string): BracketAssessment {

  return {

    level: 3, fingerprint, gameChangers: [], turns: [], turnsRestricted: [], denial: [], denialRestricted: [],

    earlyCombos: [], lateCombos: [],

  };

}



describe('useBracketCache', () => {

  it('reports the cached level while the fingerprint matches the deck, for commander decks only', () => {

    const persist = vi.fn();

    const { result, rerender } = renderHook(

      ({ enabled }) => useBracketCache(cards, assessment(deckFingerprint(cards)), persist, enabled),

      { initialProps: { enabled: true } },

    );

    expect(result.current).toBe(3);

    rerender({ enabled: false });

    expect(result.current).toBeUndefined();

    expect(persist).not.toHaveBeenCalled();

  });



  it('hides and drops an assessment whose fingerprint no longer matches, whatever is mounted elsewhere', () => {

    const persist = vi.fn();

    const stale = assessment('stale');

    const { result, rerender } = renderHook(

      ({ current }) => useBracketCache(current, stale, persist, true),

      { initialProps: { current: cards } },

    );

    expect(result.current).toBeUndefined();

    expect(persist).toHaveBeenCalledWith(undefined);

    expect(persist).toHaveBeenCalledTimes(1);



    rerender({ current: [...cards, { name: 'Ponder', quantity: 1, category: 'main', lookupSource: 'scryfall' }] });

    expect(persist).toHaveBeenCalledTimes(1);

  });



  it('does nothing without an assessment', () => {

    const persist = vi.fn();

    const { result } = renderHook(() => useBracketCache(cards, undefined, persist, true));

    expect(result.current).toBeUndefined();

    expect(persist).not.toHaveBeenCalled();

  });

});

