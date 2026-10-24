import { isMtgFormat } from '@app/types';

import { sortIndicesByName, type DeckCardGroup } from './deckGrouping';
import { previewImageUrls } from './scryfallImage';
import type { HydratedDeck } from './types';

export interface ImageWarmQueue {
  pending: readonly string[];
  active: readonly string[];
  cancelled: boolean;
}

export function deckImageWarmUrls(deck: HydratedDeck, groups: readonly DeckCardGroup[]): string[] {
  const commanders = deck.cards.filter((card) => card.isCommander);
  const banner = deck.cards.find((card) => card.name === deck.bannerCard
    && (!deck.bannerCardProviderId || card.scryfallId === deck.bannerCardProviderId));
  const order = isMtgFormat(deck.format)
    ? groups.flatMap(({ indices }) => indices)
    : sortIndicesByName(deck.cards, deck.cards.map((_, index) => index));
  return previewImageUrls([
    ...commanders,
    ...(banner ? [banner] : []),
    ...order.map((index) => deck.cards[index]),
  ]);
}

function fillImageWarmQueue(queue: ImageWarmQueue): ImageWarmQueue {
  const slots = 6 - queue.active.length;
  return {
    ...queue,
    active: [...queue.active, ...queue.pending.slice(0, slots)],
    pending: queue.pending.slice(slots),
  };
}

export function createImageWarmQueue(urls: readonly string[], warmed: ReadonlySet<string>): ImageWarmQueue {
  return fillImageWarmQueue({
    pending: [...new Set(urls)].filter((url) => !warmed.has(url)), active: [], cancelled: false,
  });
}

export function settleImageWarmQueue(queue: ImageWarmQueue, url: string): ImageWarmQueue {
  if (queue.cancelled || !queue.active.includes(url)) {
    return queue;
  }
  return fillImageWarmQueue({ ...queue, active: queue.active.filter((active) => active !== url) });
}

export function cancelImageWarmQueue(queue: ImageWarmQueue): ImageWarmQueue {
  return { ...queue, pending: [], active: [], cancelled: true };
}
