import { useEffect, useMemo, useState } from 'react';
import { ScryfallImageSize, type games } from '@cockatrice/datatrice';
import { useCardDataPreferences, useCardImageUrls, useImageCandidates } from '@app/hooks';
import { CardDTO, printingsOf, sortBySetPreference, type CardImageSubject } from '@app/services';

import { playmatArtCropUrls, playmatFullImageUrls, playmatImageSources } from './playmatImageUrls';

const NO_PREFERENCES = new Map();

export interface PlaymatImageState {
  src: string | null;
  onError: () => void;
  isArtCrop: boolean;
  landscapeCard: boolean;
}

export function usePlaymatImage({ cardName, cardProviderId }: games.Playmat): PlaymatImageState {
  const [lookup, setLookup] = useState<{ name: string; card: CardDTO | undefined }>();
  useEffect(() => {
    let active = true;
    void CardDTO.get(cardName).then(
      (card) => {
        if (active) {
          setLookup({ name: cardName, card });
        }
      },
      () => {
        if (active) {
          setLookup({ name: cardName, card: undefined });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [cardName]);
  const card = lookup?.name === cardName ? lookup.card : undefined;
  const subject = useMemo<CardImageSubject | undefined>(() => {
    if (lookup?.name !== cardName) {
      return undefined;
    }
    if (!card) {
      return { name: { value: cardName } };
    }
    const printings = printingsOf(card);
    return { ...card, set: [
      ...printings.filter((printing) => printing.uuid === cardProviderId),
      ...printings.filter((printing) => printing.uuid !== cardProviderId),
    ] };
  }, [lookup, card, cardName, cardProviderId]);
  const preferred = card && printingsOf(card).find((printing) => printing.uuid === cardProviderId);
  const preferences = useCardDataPreferences();
  const setPreferences = preferences.value?.setPreferences ?? NO_PREFERENCES;
  const candidates = useCardImageUrls(subject, preferred?.value, ScryfallImageSize.Large);
  const sources = useMemo(() => {
    const firstPrinting = card && sortBySetPreference(printingsOf(card), (printing) => printing.value, setPreferences)[0];
    return playmatImageSources(
      playmatArtCropUrls(cardName, [cardProviderId, firstPrinting?.uuid]),
      playmatFullImageUrls(candidates, cardName, cardProviderId, !!preferred),
    );
  }, [candidates, card, cardName, cardProviderId, preferred, setPreferences]);
  const { src, onError } = useImageCandidates(sources.urls);
  return {
    src,
    onError,
    isArtCrop: !!src && sources.artCrops.has(src),
    landscapeCard: card?.landscapeOrientation?.value === '1',
  };
}
