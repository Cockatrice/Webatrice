import { useEffect, useMemo } from 'react';

import { onSessionEnd } from '@app/services/session';

import type { DeckCardGroup } from '../deckGrouping';
import { cancelImageWarmQueue, createImageWarmQueue, deckImageWarmUrls, settleImageWarmQueue } from '../deckImageWarmQueue';
import type { HydratedDeck } from '../types';

const warmedUrls = new Set<string>();
onSessionEnd(() => warmedUrls.clear());

function warmImages(urls: readonly string[]): () => void {
  let queue = createImageWarmQueue(urls, warmedUrls);
  const images = new Map<string, HTMLImageElement>();
  const pump = () => {
    for (const url of queue.active) {
      if (images.has(url)) {
        continue;
      }
      const image = new Image();
      images.set(url, image);
      const settle = (loaded: boolean) => {
        if (queue.cancelled || !images.has(url)) {
          return;
        }
        image.onload = null;
        image.onerror = null;
        images.delete(url);
        if (loaded) {
          warmedUrls.add(url);
        }
        queue = settleImageWarmQueue(queue, url);
        pump();
      };
      image.onload = () => settle(true);
      image.onerror = () => settle(false);
      image.src = url;
    }
  };
  pump();
  return () => {
    queue = cancelImageWarmQueue(queue);
    for (const image of images.values()) {
      image.onload = null;
      image.onerror = null;
      image.src = '';
    }
    images.clear();
  };
}

export function useDeckImageWarmer(
  deckId: number | string | null, deck: HydratedDeck | null, groups: readonly DeckCardGroup[], loading: boolean,
): void {
  const urlKey = useMemo(() => JSON.stringify(deck ? deckImageWarmUrls(deck, groups) : []), [deck, groups]);
  useEffect(() => {
    if (loading || deckId == null) {
      return;
    }
    const cancel = warmImages(JSON.parse(urlKey) as string[]);
    const unsubscribe = onSessionEnd(cancel);
    return () => {
      cancel();
      unsubscribe();
    };
  }, [deckId, loading, urlKey]);
}
