import { act, renderHook, waitFor } from '@testing-library/react';



const hoisted = vi.hoisted(() => {

  const refreshed: { listener?: (preferences: unknown) => void } = {};

  return {

    load: vi.fn(),

    reload: vi.fn(),

    refreshed,

    onRefreshed: (listener: (preferences: unknown) => void) => {

      refreshed.listener = listener;

      return () => {};

    },

  };

});



vi.mock('@app/services', async (importOriginal) => ({

  ...(await importOriginal<typeof import('@app/services')>()),

  currentCardDataPreferences: hoisted.load,

  refreshCardDataPreferences: hoisted.reload,

  onCardDataPreferencesRefreshed: hoisted.onRefreshed,

}));



import type { CardDataPreferences } from '@app/services';

import {

  cardDataPreferencesStore,

  refreshCardDataPreferences,

  useCardImageUrls,

  useImageCandidates,

} from './useCardDataPreferences';



const makePreferences = (templates: string[]): CardDataPreferences => ({

  setPreferences: new Map([['M10', { code: 'M10', sortKey: 0, enabled: true, isKnown: true }]]),

  setLongNames: new Map(),

  pictureUrlTemplates: templates,

});



describe('useCardDataPreferences', () => {

  beforeEach(() => {

    cardDataPreferencesStore.reset();

  });



  it('refreshCardDataPreferences pushes the reloaded snapshot into the store', async () => {

    hoisted.load.mockResolvedValueOnce(makePreferences(['https://a/!name!']));

    expect((await cardDataPreferencesStore.whenReady()).pictureUrlTemplates).toEqual(['https://a/!name!']);



    hoisted.reload.mockResolvedValueOnce(makePreferences(['https://b/!name!']));

    await refreshCardDataPreferences();

    expect(cardDataPreferencesStore.peek()?.pictureUrlTemplates).toEqual(['https://b/!name!']);

  });



  it('takes refreshes made by the card database service into the store', async () => {

    hoisted.load.mockResolvedValueOnce(makePreferences(['https://a/!name!']));

    await cardDataPreferencesStore.whenReady();



    hoisted.refreshed.listener?.(makePreferences(['https://c/!name!']));



    expect(cardDataPreferencesStore.peek()?.pictureUrlTemplates).toEqual(['https://c/!name!']);

  });



  it('useCardImageUrls is empty while loading, then resolves against the stored templates', async () => {

    hoisted.load.mockResolvedValueOnce(makePreferences(['https://img/!setcode!/!name!.jpg']));

    const card = { name: { value: 'Bolt' }, set: { value: 'M10' } };



    const { result } = renderHook(() => useCardImageUrls(card));

    expect(result.current).toEqual([]);



    await waitFor(() => expect(result.current[0]).toBe('https://img/M10/Bolt.jpg'));

    expect(result.current[result.current.length - 1]).toContain('api.scryfall.com/cards/named?exact=Bolt');

  });



  it('useCardImageUrls follows the exact-name pinned printing', async () => {
    hoisted.load.mockResolvedValueOnce({
      ...makePreferences(['https://img/!setcode!/!set:uuid!.jpg']),
      cardOverrides: { Bolt: 'cccc' },
    });
    const card = {
      name: { value: 'Bolt' },
      set: [{ value: 'LEA', uuid: 'aaaa' }, { value: 'OFF', uuid: 'cccc' }],
    };

    const { result } = renderHook(() => useCardImageUrls(card));

    await waitFor(() => expect(result.current[0]).toBe('https://img/OFF/cccc.jpg'));
  });

  it('useCardImageUrls returns nothing for a missing card', async () => {

    hoisted.load.mockResolvedValueOnce(makePreferences([]));

    const { result } = renderHook(() => useCardImageUrls(undefined));

    await act(async () => {

      await cardDataPreferencesStore.whenReady();

    });

    expect(result.current).toEqual([]);

  });

});



describe('useImageCandidates', () => {

  it('advances through the list on each error and ends at null', () => {

    const urls = ['a', 'b'];

    const { result } = renderHook(() => useImageCandidates(urls));

    expect(result.current.src).toBe('a');



    act(() => result.current.onError());

    expect(result.current.src).toBe('b');



    act(() => result.current.onError());

    expect(result.current.src).toBeNull();

  });



  it('starts over when the candidate list changes', () => {

    const { result, rerender } = renderHook(({ urls }) => useImageCandidates(urls), {

      initialProps: { urls: ['a', 'b'] },

    });

    act(() => result.current.onError());

    expect(result.current.src).toBe('b');



    rerender({ urls: ['c', 'd'] });

    expect(result.current.src).toBe('c');

  });

});

