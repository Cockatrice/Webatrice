import { ScryfallImageSize } from '@cockatrice/datatrice';

import { useMemo, useState } from 'react';



import {

  cardOverride,

  currentCardDataPreferences,

  DEFAULT_PICTURE_URL_TEMPLATES,

  onCardDataPreferencesRefreshed,

  refreshCardDataPreferences as reloadCardDataPreferences,

  resolveCardImageUrls,

  type CardDataPreferences,

  type CardImageSubject,

} from '@app/services';



import { createSharedStore, LoadingState, useSharedStore, type Loadable } from './useSharedStore';



let followsRefreshes = false;



export const cardDataPreferencesStore = createSharedStore<CardDataPreferences>(() => {

  if (!followsRefreshes) {

    followsRefreshes = true;

    onCardDataPreferencesRefreshed((next) => cardDataPreferencesStore.setValue(next));

  }

  return currentCardDataPreferences();

});



export async function refreshCardDataPreferences(): Promise<CardDataPreferences> {

  const next = await reloadCardDataPreferences();

  cardDataPreferencesStore.setValue(next);

  return next;

}



export function useCardDataPreferences(): Loadable<CardDataPreferences> {

  return useSharedStore(cardDataPreferencesStore);

}



export function useImageCandidates(urls: readonly string[]): { src: string | null; onError: () => void } {

  const key = urls.join('\n');

  const [failed, setFailed] = useState({ key, count: 0 });

  const index = failed.key === key ? failed.count : 0;

  return {

    src: urls[index] ?? null,

    onError: () => setFailed({ key, count: index + 1 }),

  };

}



export function useCardImageUrls(

  card: CardImageSubject | null | undefined, preferredSet?: string, fallbackSize = ScryfallImageSize.Normal,

): string[] {

  const preferences = useCardDataPreferences();

  return useMemo(() => {

    if (!card || preferences.status === LoadingState.LOADING) {

      return [];

    }

    const value = preferences.value;

    return resolveCardImageUrls(card, {

      templates: value?.pictureUrlTemplates ?? DEFAULT_PICTURE_URL_TEMPLATES,

      setPreferences: value?.setPreferences ?? new Map(),

      setLongNames: value?.setLongNames,

      preferredSet,

      pinnedPrintingId: cardOverride(value?.cardOverrides, card.name?.value ?? ''),

      fallbackSize,

    });

  }, [card, preferences, preferredSet, fallbackSize]);

}

